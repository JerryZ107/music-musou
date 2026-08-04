#!/bin/bash
set -e
PKG=/root/musicgame_build/.buildozer/android/platform/build-arm64-v8a/packages/python3
SRC=/root/py311_patch
rm -rf "$SRC"
mkdir -p "$SRC"
cd "$SRC"
tar xzf "$PKG/v3.11.9.tar.gz"
cd cpython-3.11.9

# Patch grpmodule.c for Android:
# 1) Undef the HAVE_GETGRENT family (harmless belt & braces), and
# 2) make grp_getgrall_impl return an empty list on Android, because it
#    calls getgrent/setgrent/endgrent without any HAVE_* guard in 3.11 and
#    the NDK headers hide those declarations (implicit-declaration error).
python3 - <<'PYEOF'
from pathlib import Path
p = Path("Modules/grpmodule.c")
text = p.read_text(encoding="utf-8")
anchor = '#include "Python.h"\n'
guard = anchor + '''
#if defined(__ANDROID__)
/* getgrent/setgrent/endgrent are not usable on Android (hidden behind
 * __ANDROID_API__ guards, and pointless there anyway). */
#undef HAVE_GETGRENT
#undef HAVE_SETGRENT
#undef HAVE_ENDGRENT
#endif
'''
assert text.count(anchor) == 1, "anchor not found or duplicated"
text = text.replace(anchor, guard, 1)

fn_open = """grp_getgrall_impl(PyObject *module)
/*[clinic end generated code: output=585dad35e2e763d7 input=d7df76c825c367df]*/
{
    PyObject *d;"""
android_empty = """grp_getgrall_impl(PyObject *module)
/*[clinic end generated code: output=585dad35e2e763d7 input=d7df76c825c367df]*/
{
#if defined(__ANDROID__)
    /* getgrent/setgrent/endgrent are unavailable on Android. */
    return PyList_New(0);
#else
    PyObject *d;"""
assert text.count(fn_open) == 1, "grp_getgrall_impl open not found"
text = text.replace(fn_open, android_empty, 1)

fn_close = """    endgrent();
    return d;
}"""
assert text.count(fn_close) == 1, "grp_getgrall_impl close not found"
text = text.replace(fn_close, """    endgrent();
    return d;
#endif
}""", 1)
p.write_text(text, encoding="utf-8")
print("patched grpmodule.c (undefs + getgrall android stub)")
PYEOF

cd "$SRC"
rm -f "$PKG/v3.11.9.tar.gz" "$PKG/.mark-v3.11.9.tar.gz"
tar czf "$PKG/v3.11.9.tar.gz" cpython-3.11.9
touch "$PKG/.mark-v3.11.9.tar.gz"
echo "-- verify patch is in the new tarball --"
tar xOzf "$PKG/v3.11.9.tar.gz" cpython-3.11.9/Modules/grpmodule.c | grep -n "API 26" | head -3
du -h "$PKG/v3.11.9.tar.gz"
