# Authenticating to Azure DevOps with GitHub Desktop

GitHub Desktop now provides support for [Git Credential Manager (GCM)](https://gh.io/gcm), which makes the task of authenticating to Azure DevOps repositories easy and secure. This feature can be enabled by going to **File** > **Options** > **Advanced** on Windows, or **GitHub Desktop** > **Preferences** > **Advanced** on macOS, and then selecting the **Use Git Credential Manager** checkbox.

*Image omitted from the offline bundle: screenshot of the GitHub Desktop settings menu with the "Use Git Credential Manager" checkbox outlined.*

When GCM is enabled all credentials for Azure DevOps will be handled, and stored, outside of GitHub Desktop. GCM supports browser authentication and will avoid the need to create personal access tokens (PATs). 

Your browser will open to authenticate to your Azure DevOps account using GCM when you go to **File** > **Clone Repository** > **URL** and enter the HTTPS clone URL of the repository.

*Image omitted from the offline bundle: screenshot of a browser window showing the option to pick a Microsoft account.*

If you would prefer not to use GCM and need to create a personal access token in Azure DevOps you can follow the steps below.



## Creating a Personal Access Token in Azure DevOps

To authenticate against Azure DevOps repositories you will need to create a personal access token.

1. Go to your Azure DevOps account and select **Personal Access Tokens** in the user settings dropdown:

*Image omitted from the offline bundle: unnamed image.*

2. Click **New token** to create a new personal access token. Give it a name, select the organizations you would like the token to apply to, and choose when you would like the token to expire.

   - **Note:** For the **Expiration** dropdown you can select **Custom defined** to select an expiration date up to a year in advance of the current date. This is useful if you do not want to have to periodically go back and generate a new token after your current token expires.

3 . Under the **Scopes** section choose **Custom defined** and then select **Read & Write** under the **Code** section. This will grant GitHub Desktop read and write access to your Azure DevOps repositories.

4 . Click **Create** to create a new token, and then copy it to your clipboard.

 *Image omitted from the offline bundle: unnamed image.*

## Cloning your Azure DevOps repository in GitHub Desktop

 1. Open GitHub Desktop and go to **File** > **Clone Repository** > **URL**. Enter the Git URL of your Azure DevOps repository. Make sure you enter the correct URL, which should have the following structure:

      `https://<username>@dev.azure.com/<username>/<project_name>/_git/<repository_name>`

 2. You will receive an `Authentication Failed` error. Enter your Azure DevOps username and paste in the token you just copied to your clipboard. Click **Save and Retry** to successfully clone the repository to your local machine in GitHub Desktop.

*Image omitted from the offline bundle: unnamed image.*

   - **Note:** Your Azure DevOps credentials will be securely stored on your local machine so you will not need to repeat this process when cloning another repository from Azure DevOps.
