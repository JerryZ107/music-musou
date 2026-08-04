#!/bin/bash
# Fix pygame 2.5.2 Android build: the Android Setup template omits
# simd_blitters_sse2.c, so surface.so references alphablit_alpha_sse2_* symbols
# that are never defined -> dlopen fails on ARM64 -> pygame.display unavailable
# -> app crashes at set_mode (masked by the HWUI hwuiTask teardown crash).
set -e

P4A=/root/musicgame_build/.buildozer/android/platform/python-for-android
RECIPE="$P4A/pythonforandroid/recipes/pygame/__init__.py"
BUILD=/root/musicgame_build/.buildozer/android/platform/build-arm64-v8a

# 1) Durable recipe fix: enable ARM NEON and add simd_blitters_sse2.c to the
#    surface module sources in the generated Setup file.
if ! grep -q "simd_blitters_sse2" "$RECIPE"; then
  perl -0pi -e '
     s/(            open\("Setup", "w"\)\.write\(setup_file\))/            setup_file = setup_file.replace(\n                "surface src_c\/surface.c src_c\/alphablit.c src_c\/surface_fill.c \$(SDL) \$(DEBUG)",\n                "surface src_c\/simd_blitters_sse2.c src_c\/simd_blitters_avx2.c src_c\/surface.c src_c\/alphablit.c src_c\/surface_fill.c \$(SDL) \$(DEBUG)"\n            )\n$1/;
    s/(    def get_recipe_env\(self, arch\):\n        env = super\(\)\.get_recipe_env\(arch\)\n)/$1        if self.ctx.python_recipe:\n            env["CFLAGS"] += " -I" + join(self.ctx.python_recipe.include_root(arch.arch), "cpython")\n        env["CFLAGS"] += " -DPG_ENABLE_ARM_NEON=1"\n/;
  ' "$RECIPE"
fi
grep -n "simd_blitters_sse2\|PG_ENABLE_ARM_NEON" "$RECIPE"

# 2) Force a clean pygame rebuild so the stale .o files do not survive.
rm -rf "$BUILD/build/other_builds/pygame"

# 3) Drop the old broken pygame from the dist bundle so it is reinstalled.
rm -rf "$BUILD/dists/musicmusou/_python_bundle__arm64-v8a/_python_bundle/site-packages/pygame"

echo "pygame fix staged"
