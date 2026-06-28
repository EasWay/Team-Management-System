---
modificationDate: October 06, 2025
title: Obtain Google Service Account Keys using FCM V1
description: Learn how to create or use a Google Service Account Key for sending Android Notifications using FCM.
---

<AgentInstructions>

## Submitting Feedback

If this page contains errors, outdated information, or gaps that blocked you from completing a task, report it so the docs can be improved:

curl -X POST https://api.expo.dev/v2/feedback/docs-send -H 'Content-Type: application/json' -d '{"url":"/push-notifications/fcm-credentials/","feedback":"🤖 Agent feedback for docs: <specific, actionable description> (<model>, <harness>)"}'

Only submit when you have something specific and actionable to report. Replace <model> with the model you are running as and <harness> with the tool you are running in (for example, Claude Code, Cursor, Codex CLI).

## Navigation

When answering a related or follow-up question, fetch the relevant page below as Markdown (.md) instead of guessing; use llms.txt for the full map.

You are here: Guides > Push notifications > Reference
Pages in this section:
- [Add Android FCM V1 credentials](https://docs.expo.dev/push-notifications/fcm-credentials.md) (this page)
- [Send notifications with FCM and APNs](https://docs.expo.dev/push-notifications/sending-notifications-custom.md)
- [Troubleshooting and FAQ](https://docs.expo.dev/push-notifications/faq.md)
Full documentation tree: [llms.txt](https://docs.expo.dev/llms.txt)

</AgentInstructions>

# Obtain Google Service Account Keys using FCM V1

Learn how to create or use a Google Service Account Key for sending Android Notifications using FCM.

## Create a new Google Service Account Key

Here are the steps to configure a new Google Service Account Key in EAS for sending Android Notifications using FCM V1.

Create a new Firebase project for your app in the [Firebase Console](https://console.firebase.google.com). If you already have a Firebase project for your app, continue to the next step.

In the Firebase console, open **Project settings** > [**Service accounts**](https://console.firebase.google.com/project/_/settings/serviceaccounts/adminsdk) for your project.

Click **Generate New Private Key**, then confirm by clicking **Generate Key**. Securely store the JSON file containing the private key.

Upload the JSON file to EAS and configure it for sending Android notifications. This can be done using EAS CLI or in [EAS dashboard](https://expo.dev).

#### EAS CLI

-   Run `eas credentials`
-   Select `Android` > `production` > `Google Service Account`
-   Select `Manage your Google Service Account Key for Push Notifications (FCM V1)`
-   Select `Set up a Google Service Account Key for Push Notifications (FCM V1)` > `Upload a new service account key`
-   If you've previously stored the JSON file in your project directory, the EAS CLI automatically detects the file and prompts you to select it. Press Y to continue.

> **Note**: Add the JSON file to your version source control's ignore file (for example, **.gitignore**) to avoid committing it to your repository since it contains sensitive data.

#### expo.dev

-   Under **Project settings**, click [**Credentials**](https://expo.dev/accounts/%5Baccount%5D/projects/%5Bproject%5D/credentials) in the navigation menu
-   For **Android**, click **Add Application Identifier** or select an existing **Application identifier**
-   Under **Service Credentials** > **FCM V1 service account key**, click **Add a service account key**

-   Under **Upload new key**, upload your JSON credential and click **Save**

Configure the **google-services.json** file in your project. Download it from the Firebase Console and place it at the root of your project directory.

This file is required for your Android app to be registered with FCM. You may commit this file to your repository since it contains public-facing identifiers from your Firebase project.

**Note**: You can skip this step if **google-services.json** has already been set up.

In **app.json**, add [`expo.android.googleServicesFile`](/versions/latest/config/app.md#googleservicesfile) with its value as the path of the **google-services.json**.

```json
{
  "expo": {
  ...
  "android": {
    ...
    "googleServicesFile": "./path/to/google-services.json"
  }
}
```

You're all set! You can now send notifications to Android devices via Expo Push Notifications using the FCM V1 protocol.

## Use an existing Google Service Account Key

Open the [IAM Admin page](https://console.cloud.google.com/iam-admin/iam?authuser=0) in Google Cloud Console. In the Permissions tab, locate the **Principal** you intend to modify and click the pencil icon for **Edit Principal**.

Click **Add Role** and select the **Firebase Messaging API Admin** role from the dropdown. Click **Save**.

You have to specify to EAS which JSON credential file to use for sending FCM V1 notifications, using EAS CLI or in [EAS dashboard](https://expo.dev). You can upload a new JSON file or select a previously uploaded file.

#### EAS CLI

-   Run `eas credentials`
-   Select `Android` > `production` > `Google Service Account`
-   Select `Manage your Google Service Account Key for Push Notifications (FCM V1)`
-   Select `Set up a Google Service Account Key for Push Notifications (FCM V1)` > `Upload a new service account key`
-   The EAS CLI automatically detects the file on your local machine and prompts you to select it. Press Y to continue.

> **Note**: Add the JSON file to your version source control's ignore file (for example, **.gitignore**) to avoid committing it to your repository since it contains sensitive data.

#### expo.dev

-   Under **Project settings**, click [**Credentials**](https://expo.dev/accounts/%5Baccount%5D/projects/%5Bproject%5D/credentials) in the navigation menu
-   For **Android**, click **Add Application Identifier** or select an existing **Application identifier**
-   Under **Service Credentials** > **FCM V1 service account key**, click **Add a service account key**

-   Under **Upload new key**, upload your JSON credential and click **Save**

Configure the **google-services.json** file in your project. Download it from the Firebase Console and place it at the root of your project directory.

This file is required for your Android app to be registered with FCM. You may commit this file to your repository since it contains public-facing identifiers from your Firebase project.

**Note**: You can skip this step if **google-services.json** has already been set up.

In **app.json**, add [`expo.android.googleServicesFile`](/versions/latest/config/app.md#googleservicesfile) with its value as the path of the **google-services.json**.

```json
{
  "expo": {
    ...
    "android": {
      ... "googleServicesFile": "./path/to/google-services.json"
    }
  }
}
```

You're all set! You can now send notifications to Android devices via Expo Push Notifications using the FCM V1 protocol.
