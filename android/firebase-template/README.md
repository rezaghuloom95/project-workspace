# Optional native Firebase push

The installable PWA already supports browser notifications on Android. To add native FCM delivery to the wrapper:

1. Add Firebase Android app package `com.clubmediaplanner.app`.
2. Put `google-services.json` in `android/app/`.
3. Add the Google Services Gradle plugin and Firebase Messaging dependency.
4. Add a `FirebaseMessagingService` that registers the token with the planner API.
5. Use data messages containing `url` or `eventId`; notification taps should open `clubmediaplanner://event/{id}`.

Do not commit Firebase credentials.
