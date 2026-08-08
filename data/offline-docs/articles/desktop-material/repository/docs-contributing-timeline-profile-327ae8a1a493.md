# Profiling Desktop using the Chrome Developer Tools

Sometimes performance issues are hard to identify and recreate. If you notice
a regression and can reproduce it, you can use the Timeline tools in Chrome Dev
Tools to take a snapshot of the application performance and attach it to an
issue.

## Steps

 - Launch Desktop and select **View** | **Toggle Developer Tools**.
  
 *Image or external asset omitted from the offline bundle.*

 - Get the Desktop application ready to perform the problem action.
 - Select the **Performance** tab. Ensure the **Disable JavaScript samples** option is **unchecked**.

*Image or external asset omitted from the offline bundle.*

 - Press the **Record** button on the left to start recording.

*Image or external asset omitted from the offline bundle.*

 - Perform the problem action in Desktop. Try and keep the test focused on the
   issue you're seeing.
 - Switch back to the Developer tools and press **Stop** to complete recording.

*Image or external asset omitted from the offline bundle.*

 - In the header, click the **Save profile...** menu item. Save the JSON file
   somewhere you can access later.

*Image or external asset omitted from the offline bundle.*

 - Compress the JSON file to reduce the file size (it could be 10MB or more
   depending on how long you ran the test for).

 - Attach the file to your GitHub issue so the contributors can load this into
   their environment and spelunk the diagnostic information.
