"""Rebuild ONLY the pygame recipe in the existing p4a dist.

Replicates what `build_dist_from_args` does, but calls build_recipes with just
pygame so we don't have to rebuild python3/SDL/etc.
"""

import os
import sys

P4A = "/root/musicgame_build/.buildozer/android/platform/python-for-android"
sys.path.insert(0, P4A)

from pythonforandroid.toolchain import Context  # noqa: E402
from pythonforandroid.distribution import Distribution  # noqa: E402
from pythonforandroid.bootstrap import Bootstrap  # noqa: E402
from pythonforandroid.build import build_recipes  # noqa: E402

STORAGE = "/root/musicgame_build/.buildozer/android/platform/build-arm64-v8a"
SDK = "/root/.buildozer/android/platform/android-sdk"
NDK = "/root/.buildozer/android/platform/android-ndk-r25b"

# p4a applies version pins via VERSION_<name> env vars (toolchain.run).
os.environ["VERSION_python3"] = "3.11.9"
os.environ["VERSION_hostpython3"] = "3.11.9"
os.environ["VERSION_pygame"] = "2.5.2"

ctx = Context()
ctx.storage_dir = STORAGE
ctx.setup_dirs(STORAGE)
ctx.set_archs(["arm64-v8a"])
ctx.prepare_build_environment(
    user_sdk_dir=SDK,
    user_ndk_dir=NDK,
    user_android_api=33,
    user_ndk_api=24,
)
ctx.build_as_debuggable = True

recipes = ["python3", "hostpython3", "pygame"]
dist = Distribution.get_distribution(
    ctx,
    name="musicmusou",
    archs=["arm64-v8a"],
    recipes=recipes,
    ndk_api=24,
    require_perfect_match=False,
    allow_replace_dist=False,
)
bs = Bootstrap.get_bootstrap("sdl2", ctx)
bs.distribution = dist
ctx.distribution = dist
ctx.prepare_bootstrap(bs)
ctx.recipe_build_order = ["pygame"]

build_recipes(
    ["pygame"],
    [],
    ctx,
    "/root/musicgame_build",
    ignore_project_setup_py=True,
)
print("PYGAME REBUILD DONE")
