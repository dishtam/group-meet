import React, { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { Device } from "mediasoup-client";
import { v4 as uuidv4 } from "uuid"; // For generating a unique peerId

const SERVER_URL = "http://localhost:3000"; // Update with your server URL if different

const VideoChat = () => {
  const [socket, setSocket] = useState(null);
  const [roomId, setRoomId] = useState("");
  const [joined, setJoined] = useState(false);
  const videoRef = useRef(null);

  // Hold mediasoup-related variables as refs to persist across renders
  const deviceRef = useRef(null);
  const producerTransportRef = useRef(null);
  const peerIdRef = useRef(uuidv4());

  useEffect(() => {
    const newSocket = io(SERVER_URL);
    setSocket(newSocket);

    // Clean up socket on unmount
    return () => newSocket.close();
  }, []);

  // Function to create a room on the server
  const createRoom = () => {
    if (!socket || !roomId) return;
    socket.emit("create-room", roomId);
  };

  // Listen for the room creation confirmation
  useEffect(() => {
    if (!socket) return;

    socket.on("room-created", (data) => {
      console.log("Room created:", data.roomId);
      // Once the room is created, emit join-room to get transport parameters
      socket.emit("join-room", {
        roomId: data.roomId,
        peerId: peerIdRef.current,
      });
    });

    socket.on("room-joined", async (transportData) => {
      console.log("Joined room, transport options received:", transportData);
      await joinRoomTransport(transportData);
      setJoined(true);
    });

    socket.on("new-peer", (newPeerId) => {
      console.log("A new peer has joined:", newPeerId);
      // You might want to update UI or perform additional actions here.
    });

    // Optional: handle errors (if your backend emits error events)
    socket.on("error", (err) => console.error("Socket error:", err));

    // Clean up listeners on unmount or socket change
    return () => {
      socket.off("room-created");
      socket.off("room-joined");
      socket.off("new-peer");
      socket.off("error");
    };
  }, [socket]);

  // This function sets up local media, initializes the mediasoup Device,
  // and creates a producer transport using the transport parameters received from the backend.
  const joinRoomTransport = async (transportData) => {
    try {
      // Get local media stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Initialize mediasoup Device
      deviceRef.current = new Device();
      // NOTE: In a more complete implementation, you would pass router RTP capabilities here.
      // For this demo, we assume the device is already compatible or capabilities are provided via transportData.
      // await deviceRef.current.load({ routerRtpCapabilities: transportData.routerRtpCapabilities });

      // Create send transport on the client using ICE parameters received from the server.
      // The backend sent iceParameters and iceCandidates.
      // Depending on your mediasoup-client version, you may need to include additional parameters.
      producerTransportRef.current = deviceRef.current.createSendTransport({
        iceParameters: transportData.iceParameters,
        iceCandidates: transportData.iceCandidates,
        // dtlsParameters: transportData.dtlsParameters, // If provided by the server
      });

      // Handle the transport 'connect' event by signaling the server.
      producerTransportRef.current.on(
        "connect",
        async ({ dtlsParameters }, callback, errback) => {
          // For this demo, we simply signal the server.
          socket.emit("transport-connect", { dtlsParameters });
          // In a production implementation, you’d listen for a confirmation event.
          callback();
        }
      );

      // Start producing by sending the video track.
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const producer = await producerTransportRef.current.produce({
          track: videoTrack,
        });
        console.log("Producer started with id:", producer.id);
      } else {
        console.error("No video track available to produce.");
      }
    } catch (error) {
      console.error("Error during transport setup:", error);
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>Mediasoup Video Chat</h1>
      <input
        type="text"
        placeholder="Enter Room ID"
        value={roomId}
        onChange={(e) => setRoomId(e.target.value)}
        disabled={joined}
        style={{ padding: "8px", marginRight: "10px" }}
      />
      <button
        onClick={createRoom}
        disabled={joined || !roomId}
        style={{ padding: "8px" }}
      >
        Create & Join Room
      </button>
      <div style={{ marginTop: "20px" }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          style={{ width: "400px", border: "1px solid #ccc" }}
        />
      </div>
    </div>
  );
};

export default VideoChat;
