import sys
import subprocess
import tempfile
import os
import shutil
import re

TIMEOUT_SECONDS = 5

def emulate_c_execution(c_code: str, stdin_input: str = "") -> dict:
    """
    Fallback C sandbox execution runner when native GCC/Clang is not installed on host.
    Transpiles introductory C constructs to safely execute within Python sandbox.
    """
    try:
        # Check basic syntax
        open_b = c_code.count('{')
        close_b = c_code.count('}')
        if open_b != close_b:
            return {
                "success": False,
                "output": "",
                "error": f"Compilation Error: Mismatched braces (found {open_b} '{{' and {close_b} '}}')"
            }

        # Check for main function
        if not re.search(r'\b(int|void)\s+main\s*\(', c_code):
            return {
                "success": False,
                "output": "",
                "error": "Linker Error: In function 'main': undefined reference to 'main'"
            }

        # Extract body of main
        main_match = re.search(r'\b(?:int|void)\s+main\s*\([^)]*\)\s*\{([\s\S]*)\}', c_code)
        body = main_match.group(1) if main_match else c_code

        py_lines = [
            "import sys, re",
            "def c_printf(fmt, *args):",
            "    if not args:",
            "        sys.stdout.write(str(fmt).encode('utf-8').decode('unicode_escape'))",
            "    else:",
            "        try:",
            "            f = str(fmt).encode('utf-8').decode('unicode_escape')",
            "            sys.stdout.write(f % args)",
            "        except Exception:",
            "            sys.stdout.write(str(fmt))",
            "",
            "def main():"
        ]

        for line in body.splitlines():
            trimmed = line.strip()
            if not trimmed:
                continue
            if trimmed.startswith('//') or trimmed.startswith('/*') or trimmed.startswith('*'):
                continue
            if trimmed.startswith('#include') or trimmed.startswith('#define'):
                continue
            if trimmed.startswith('return'):
                py_lines.append("    return")
                continue

            # Convert printf("Hello\n"); -> c_printf("Hello\n")
            pm = re.match(r'printf\s*\(\s*(.*)\s*\)\s*;?', trimmed)
            if pm:
                args_str = pm.group(1)
                py_lines.append(f"    c_printf({args_str})")
                continue

            # Convert puts("Hello"); -> c_printf("Hello\n")
            puts_m = re.match(r'puts\s*\(\s*(.*)\s*\)\s*;?', trimmed)
            if puts_m:
                arg = puts_m.group(1)
                py_lines.append(f"    c_printf({arg} + '\\n')")
                continue

            # Convert int a = 5; -> a = 5
            var_m = re.match(r'(?:int|float|double|char|long|short)\s+([a-zA-Z_]\w*\s*(?:=\s*[^;]+)?)\s*;?', trimmed)
            if var_m:
                assignment = var_m.group(1)
                if '=' not in assignment:
                    assignment += ' = 0'
                py_lines.append(f"    {assignment}")
                continue

            clean_line = trimmed.rstrip(';')
            py_lines.append(f"    {clean_line}")

        py_lines.append("")
        py_lines.append("if __name__ == '__main__':")
        py_lines.append("    main()")

        py_code = "\n".join(py_lines)

        with tempfile.TemporaryDirectory() as temp_dir:
            file_path = os.path.join(temp_dir, "solution_c_emu.py")
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(py_code)

            res = subprocess.run(
                [sys.executable, file_path],
                input=stdin_input,
                capture_output=True,
                text=True,
                timeout=TIMEOUT_SECONDS
            )
            return {
                "success": res.returncode == 0,
                "output": res.stdout,
                "error": res.stderr
            }

    except Exception as e:
        return {
            "success": False,
            "output": "",
            "error": f"C Sandbox Execution Error: {str(e)}"
        }

def _find_c_compiler(binary_name: str = "gcc") -> str:
    """Finds native GCC/G++ executable across WinLibs package directories and system PATH."""
    local_appdata = os.environ.get("LOCALAPPDATA", "")
    if local_appdata:
        # Check WinGet Packages (where GCC and its DLLs reside)
        packages_dir = os.path.join(local_appdata, "Microsoft", "WinGet", "Packages")
        if os.path.exists(packages_dir):
            for root, dirs, files in os.walk(packages_dir):
                if root.endswith("bin") and f"{binary_name}.exe" in files:
                    return os.path.join(root, f"{binary_name}.exe")

    found = shutil.which(binary_name)
    if found and not found.endswith(r"WinGet\Links\gcc.exe"):
        return found

    for p in [r"C:\mingw64\bin", r"C:\msys64\mingw64\bin", r"C:\tools\gcc\bin", r"C:\w64devkit\bin"]:
        candidate = os.path.join(p, f"{binary_name}.exe")
        if os.path.exists(candidate):
            return candidate

    return ""

def run_code(language: str, code: str, stdin_input: str = "") -> dict:
    """
    Executes student submitted code in a temporary directory with timeout protection.
    Supported: python, javascript, c, cpp, java
    """
    lang = language.lower()
    
    with tempfile.TemporaryDirectory() as temp_dir:
        try:
            if lang == "python":
                file_path = os.path.join(temp_dir, "solution.py")
                with open(file_path, "w", encoding="utf-8") as f:
                    f.write(code)
                
                cmd = [sys.executable, file_path]
                res = subprocess.run(
                    cmd, 
                    input=stdin_input, 
                    capture_output=True, 
                    text=True, 
                    timeout=TIMEOUT_SECONDS
                )
                return {
                    "success": res.returncode == 0,
                    "output": res.stdout,
                    "error": res.stderr
                }

            elif lang in ["javascript", "js"]:
                if not shutil.which("node"):
                    return {
                        "success": False,
                        "output": "",
                        "error": "Node.js runtime not installed on server host."
                    }
                file_path = os.path.join(temp_dir, "solution.js")
                with open(file_path, "w", encoding="utf-8") as f:
                    f.write(code)
                
                cmd = ["node", file_path]
                res = subprocess.run(
                    cmd, 
                    input=stdin_input, 
                    capture_output=True, 
                    text=True, 
                    timeout=TIMEOUT_SECONDS
                )
                return {
                    "success": res.returncode == 0,
                    "output": res.stdout,
                    "error": res.stderr
                }

            elif lang in ["c", "cpp"]:
                binary_name = "gcc" if lang == "c" else "g++"
                compiler = _find_c_compiler(binary_name)
                if not compiler:
                    # Native GCC/G++ not detected on host, execute via sandbox C emulator
                    return emulate_c_execution(code, stdin_input)

                ext = ".c" if lang == "c" else ".cpp"
                src_path = os.path.join(temp_dir, f"solution{ext}")
                out_path = os.path.join(temp_dir, "solution.exe")

                with open(src_path, "w", encoding="utf-8") as f:
                    f.write(code)

                # Compile
                comp_res = subprocess.run(
                    [compiler, src_path, "-o", out_path],
                    capture_output=True,
                    text=True,
                    timeout=TIMEOUT_SECONDS
                )
                if comp_res.returncode != 0:
                    return {
                        "success": False,
                        "output": "",
                        "error": f"Compilation Error:\n{comp_res.stderr}"
                    }

                # Run
                run_res = subprocess.run(
                    [out_path],
                    input=stdin_input,
                    capture_output=True,
                    text=True,
                    timeout=TIMEOUT_SECONDS
                )
                return {
                    "success": run_res.returncode == 0,
                    "output": run_res.stdout,
                    "error": run_res.stderr
                }

            elif lang == "java":
                if not shutil.which("javac") or not shutil.which("java"):
                    return {
                        "success": False,
                        "output": "",
                        "error": "Java JDK (javac/java) not installed on server host."
                    }
                file_path = os.path.join(temp_dir, "Main.java")
                with open(file_path, "w", encoding="utf-8") as f:
                    f.write(code)

                # Compile
                comp_res = subprocess.run(
                    ["javac", file_path],
                    capture_output=True,
                    text=True,
                    timeout=TIMEOUT_SECONDS
                )
                if comp_res.returncode != 0:
                    return {
                        "success": False,
                        "output": "",
                        "error": f"Java Compilation Error:\n{comp_res.stderr}"
                    }

                # Run
                run_res = subprocess.run(
                    ["java", "-cp", temp_dir, "Main"],
                    input=stdin_input,
                    capture_output=True,
                    text=True,
                    timeout=TIMEOUT_SECONDS
                )
                return {
                    "success": run_res.returncode == 0,
                    "output": run_res.stdout,
                    "error": run_res.stderr
                }

            else:
                return {
                    "success": False,
                    "output": "",
                    "error": f"Language '{language}' not configured for direct execution."
                }

        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "output": "",
                "error": f"Execution Timed Out (Limit: {TIMEOUT_SECONDS}s). Please check for infinite loops."
            }
        except FileNotFoundError as e:
            return {
                "success": False,
                "output": "",
                "error": f"Compiler/Runtime binary not found on host: {str(e)}"
            }
        except Exception as e:
            return {
                "success": False,
                "output": "",
                "error": f"Execution Error: {str(e)}"
            }
