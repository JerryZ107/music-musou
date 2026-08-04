[app]
# (str) Application title shown in the launcher.
title = Music Musou

# (str) Package name (lowercase, no spaces).
package.name = musicmusou

# (str) Package domain (used as Java package namespace).
package.domain = org.musou

# (str) Source directory of the application.
source.dir = .

# (list) File extensions that are bundled into the APK.
source.include_exts = py,wav,otf

# (str) Application version.
version = 0.1.0

# (list) Python requirements. pygame ships a full SDL2 build via p4a.
# Python is pinned to 3.11.9 and pygame to 2.5.2: pygame 2.1.x cannot compile
# against CPython 3.11+ (its C code still includes the removed
# longintrepr.h), while 2.5.2 supports it and ships the Android Setup
# template the p4a recipe expects.
requirements = python3==3.11.9,hostpython3==3.11.9,pygame==2.5.2

# (str) Screen orientation for the game: landscape.
orientation = landscape

# (bool) Hide the system status bar / go fullscreen.
fullscreen = 1

# (bool) Keep the screen awake while the app is in the foreground.
android.wakelock = True

# (int) Target Android API level.
android.api = 33

# (int) Minimum Android API level.
android.minapi = 24

# (str) NDK version used by python-for-android.
android.ndk = 25b

# (bool) Automatically accept the Android SDK licenses during first build.
android.accept_sdk_license = True

# (list) ABIs to build. arm64-v8a covers virtually all modern phones;
# add armeabi-v7a here only if you need to support very old devices.
android.archs = arm64-v8a

[buildozer]
# (int) Buildozer log level (0-2).
log_level = 2

# (bool) Do not warn when the build runs as root.
warn_on_root = 1
