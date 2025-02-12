Framework Overview
The framework automates interactions with GBAM Desktop using Playwright. It launches GBAM Desktop, connects via the Chrome DevTools Protocol (CDP), and facilitates automated testing of both the main application and its child processes. Below is a step-by-step breakdown of its operation:

1. Launching GBAM Desktop
The framework starts by executing a script to launch GBAM Desktop on a predefined port. This ensures a controlled and predictable environment for automation.

2. Storing Initial Process Information
Once GBAM Desktop is running, the framework records the PIDs of the initial application. These PIDs are stored to later differentiate newly spawned processes when a child application is launched.

3. Establishing Connection via CDP
The framework connects to the GBAM Desktop application using Playwright and CDP, based solely on the predefined port assigned at launch. After establishing this connection, the framework enables full communication with GBAM Desktop, allowing for complete automation. This includes searching for and launching child applications, as well as performing other automated tasks within the main application.

4. Detecting and Identifying Child Applications
When a child application is launched, the framework collects the current PIDs and compares them with the stored PIDs of the initial application. This allows it to quickly identify which new PIDs are associated with the child application.

5. Determining Listening Ports for the Child Application
Once the child application's PIDs are identified, the framework determines which ports they are listening on. Typically, a child application corresponds to a single PID and a single port.

6. Connecting to the Child Application via CDP
With the correct port identified, the framework establishes a new CDP connection via Playwright. This enables direct automation and interaction with the child application.

7. Functional Testing of the Child Application
Once connected, the framework can fully control and test the child application, including:

Navigating the UI
Performing automated actions
Validating expected behaviors