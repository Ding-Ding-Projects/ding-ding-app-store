# Authenticating GitHub Enterprise from a Desktop-dev Build

1. Find or create an organization on the GHE instance that you are an owner of
1. [Create a new OAuth app](https://developer.github.com/apps/building-oauth-apps/creating-an-oauth-app/) in the organization. Input `x-github-client://oauth` as the authorization callback URL:
   *Image or external asset omitted from the offline bundle.*
1. Insert the Client ID and Client Secret into the [`app-info.ts` file](https://github.com/desktop/desktop/blob/e3991a8c73ab10ca12fcad23f7e367707051d985/app/app-info.ts#L28-L31)
1. Build and run the Desktop-dev app
1. Go to "Preferences", click the "Accounts" tab, and sign into GitHub Enterprise. Click "Continue With Browser" to proceed with the OAuth flow
