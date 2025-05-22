# SecureMatch Kiosk

SecureMatch Kiosk is an interactive web-based application designed for public engagement through quizzes, gesture-based voting, and real-time feedback. It uses face detection, gesture classification, and WebSocket communication to create an engaging experience.

## Features

- **Face Detection**: Detects multiple faces using MediaPipe's Face Landmarker. See [`src/modules/multiFaceDetector.js`](src/modules/multiFaceDetector.js).
- **Gesture Classification**: Recognises vertical nods ("yes"), horizontal shakes ("no"), and thumb gestures. The classifier adapts to each user's neutral pose and tolerates nods in either direction. See [`src/modules/gestureClassifier.js`](src/modules/gestureClassifier.js).
- **Real-Time Voting**: Displays live vote tallies using Chart.js. See [`src/modules/voteTally.js`](src/modules/voteTally.js).
- **Visual Feedback**: Faces briefly flash green for "yes" and red for "no" using [`src/modules/overlayRenderer.js`](src/modules/overlayRenderer.js).
- **Question Rotation**: Cycles through questions with a countdown timer. See [`src/modules/questionRotator.js`](src/modules/questionRotator.js).
- **WebSocket Communication**: Synchronizes votes and chat messages across clients. See [`src/modules/chatClient.js`](src/modules/chatClient.js) and [`server/wsServer.js`](server/wsServer.js).
- **Robust Reconnects**: The client automatically reconnects with exponential backoff if the WebSocket drops.
- **Confetti Animation**: Celebratory confetti animation. See [`src/modules/confettiRenderer.js`](src/modules/confettiRenderer.js).
- **QR Code Generation**: Displays QR codes for further discussion links. See [`src/modules/qrGenerator.js`](src/modules/qrGenerator.js).
- **Reset Button**: Clears the in-memory tallies and face state for a new session.
- **Calibrate Button**: Lets users set the neutral pose for reliable detection.
- **Scoreboard**: Shows current counts for Yes and No votes.
- **Connection Status**: Shows whether the kiosk is connected to the vote server.
- **Log Panel**: Displays WebSocket events, votes and head movement coordinates for debugging.

## Project Structure

### Key Modules

- **[`src/main.js`](src/main.js)**: Entry point for the application. Initializes components and starts the main loop.
- **[`src/modules/multiFaceDetector.js`](src/modules/multiFaceDetector.js)**: Handles face detection using MediaPipe.
- **[`src/modules/gestureClassifier.js`](src/modules/gestureClassifier.js)**: Classifies gestures based on face landmarks.
- **[`src/modules/voteTally.js`](src/modules/voteTally.js)**: Manages the vote tally chart.
- **[`src/modules/questionRotator.js`](src/modules/questionRotator.js)**: Rotates questions and manages the countdown timer.
- **[`src/modules/chatClient.js`](src/modules/chatClient.js)**: Handles WebSocket communication for votes and chat.
- **[`src/modules/confettiRenderer.js`](src/modules/confettiRenderer.js)**: Displays confetti animations.
- **[`src/store.js`](src/store.js)**: Global state management.

For a high-level overview of the data flow and WebSocket messages, see [docs/architecture.md](docs/architecture.md).

## Setup and Installation

1.  Clone the repository:
    ```sh
    git clone <repository-url>
    cd securematch-kiosk
    ```

2.  Install dependencies (as defined in [`package.json`](package.json)):
    ```sh
    npm install
    ```

3.  Start the development server (uses [`vite.config.js`](vite.config.js)):
    ```sh
    npm run dev
    ```

4.  Start the WebSocket server (defined in `scripts` in [`package.json`](package.json), runs [`server/wsServer.js`](server/wsServer.js)):
    ```sh
    npm run start:ws
    ```

5.  (Optional) Configure the WebSocket URL by creating a `.env` file and setting `VITE_WS_URL`:
    ```
    VITE_WS_URL=ws://localhost:4000
    ```

6.  Open the application in your browser at [http://localhost:5173](http://localhost:5173) (port configured in [`vite.config.js`](vite.config.js)).

## Starting the Kiosk

1.  In one terminal, start the WebSocket server:
    ```sh
    npm run start:ws
    ```
2.  In a second terminal, launch the app:
    ```sh
    npm run dev
    ```
3.  Visit [http://localhost:5173](http://localhost:5173) and step into the frame to begin.

## Usage

1.  **Step into the frame**: The attractor screen (defined in [`index.html`](index.html) and managed by [`src/modules/attractor.js`](src/modules/attractor.js)) will disappear once a face is detected by [`src/modules/camera.js`](src/modules/camera.js) and [`src/modules/multiFaceDetector.js`](src/modules/multiFaceDetector.js).
2.  **Answer questions**: Questions are displayed from [`src/modules/questionRotator.js`](src/modules/questionRotator.js). Use gestures to vote:
    - Nod **vertically** for "yes"
    - Shake your head **horizontally** for "no"
    - Thumbs up/down are also recognised
    Gestures are classified by [`src/modules/gestureClassifier.js`](src/modules/gestureClassifier.js). Votes are sent via [`src/modules/chatClient.js`](src/modules/chatClient.js). Faces flash green or red to confirm your choice.
3.  **View results**: Live vote tallies are displayed on the chart managed by [`src/modules/voteTally.js`](src/modules/voteTally.js).
4.  **Engage further**: Scan the QR code generated by [`src/modules/qrGenerator.js`](src/modules/qrGenerator.js) for additional discussion links.

### Custom Questions

Edit [`public/questions.json`](public/questions.json) to change the questions that appear in the kiosk.

## Dependencies

-   [@mediapipe/tasks-vision](https://www.npmjs.com/package/@mediapipe/tasks-vision)
-   [chart.js](https://www.chartjs.org/)
-   [ws](https://github.com/websockets/ws)
-   [vite](https://vitejs.dev/)

(See [`package.json`](package.json) for full list and versions)

## Known Issues

-   Missing MediaPipe assets: Ensure the [`face_landmarker.task`](public/models/face_landmarker.task) and [`vision_wasm_internal.js`](public/wasm/vision_wasm_internal.js) files are correctly placed in the `public/models` and `public/wasm` directories, respectively. These are loaded by [`src/modules/multiFaceDetector.js`](src/modules/multiFaceDetector.js).

For help diagnosing gesture problems, see [docs/troubleshooting.md](docs/troubleshooting.md).

## License

This project is licensed under the terms of the [MIT License](LICENSE).

## Acknowledgments

-   MediaPipe for face detection and gesture classification.
-   Chart.js for real-time chart rendering.
-   WebSocket for real-time communication.
