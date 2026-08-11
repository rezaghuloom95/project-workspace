# Project Workspace for Android

This Android project is a secure native shell around the same hosted planner used on the web. It keeps authentication cookies, WebView storage, application cache, RTL support, Android notification permission, and deep links to event records.

The production planner URL is stored in:

`app/src/main/res/values/strings.xml`

The released source package replaces the placeholder with the private hosted site URL.

For the no-software install path, open the hosted planner in Android Chrome and tap **Install app**. That route provides the same standalone screen, offline cache, bottom navigation, and browser notifications without Android Studio.
