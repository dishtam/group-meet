import React, { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { Device } from "mediasoup-client";
import { v4 as uuidv4 } from "uuid";

const SERVER_URL = "http://localhost:3000";

const VideoChat = () => {
  // Basic connection and room state.
  const [socket, setSocket] = useState(null);
  const [roomId, setRoomId] = useState("");
  const [joined, setJoined] = useState(false);
  // For displaying remote video streams.
  const [remoteStreams, setRemoteStreams] = useState([]);
  // Queue peers if consumer transport is not ready.
  const [pendingPeers, setPendingPeers] = useState([]);

  // Reference to the local video element.
  const localVideoRef = useRef(null);

  // Refs to hold mediasoup objects across renders.
  const deviceRef = useRef(null);
  const producerTransportRef = useRef(null);
  const consumerTransportRef = useRef(null);
  const peerIdRef = useRef(uuidv4());

  // Establish Socket.IO connection.
  useEffect(() => {
    const newSocket = io(SERVER_URL);
    setSocket(newSocket);
    return () => newSocket.close();
  }, []);

  // Create a room when the user clicks the button.
  const createRoom = () => {
    if (!socket || !roomId) return;
    socket.emit("create-room", roomId);
  };

  // Socket event listeners.
  useEffect(() => {
    if (!socket) return;

    // When the room is created, join it.
    socket.on("room-created", (data) => {
      console.log("Room created:", data.roomId);
      socket.emit("join-room", {
        roomId: data.roomId,
        peerId: peerIdRef.current,
      });
    });

    // When the join-room process completes, the server sends transport parameters.
    socket.on("room-joined", async (transportData) => {
      console.log("Joined room; received transport options:", transportData);
      await setupTransports(transportData);
      setJoined(true);
    });

    // When a new peer appears, try to consume its video.
    socket.on("new-peer", (newPeerId) => {
      console.log("New peer joined:", newPeerId);
      if (!consumerTransportRef.current) {
        console.log("Consumer transport not ready, queuing peer", newPeerId);
        setPendingPeers((prev) => [...prev, newPeerId]);
      } else {
        consumePeer(newPeerId);
      }
    });

    socket.on("error", (err) => console.error("Socket error:", err));

    return () => {
      socket.off("room-created");
      socket.off("room-joined");
      socket.off("new-peer");
      socket.off("error");
    };
  }, [socket]);

  // Set up consumer and producer transports.
  const setupTransports = async (transportData) => {
    try {
      // 1. Get local media stream.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // 2. Initialize the mediasoup Device with the router RTP capabilities.
      deviceRef.current = new Device();
      await deviceRef.current.load({
        routerRtpCapabilities: transportData.routerRtpCapabilities,
      });

      // 3. Establish the consumer (receive) transport first.
      consumerTransportRef.current = deviceRef.current.createRecvTransport({
        iceParameters: transportData.consumerIceParameters,
        iceCandidates: transportData.consumerIceCandidates,
        dtlsParameters: transportData.consumerDtlsParameters,
      });
      consumerTransportRef.current.on(
        "connect",
        async ({ dtlsParameters }, callback, errback) => {
          socket.emit("consumer-transport-connect", { dtlsParameters }, () => {
            callback();
          });
        }
      );

      // Process any pending peer IDs that were queued.
      if (pendingPeers.length > 0) {
        pendingPeers.forEach((peerId) => {
          consumePeer(peerId);
        });
        setPendingPeers([]);
      }

      // 4. Establish the producer (send) transport.
      producerTransportRef.current = deviceRef.current.createSendTransport({
        iceParameters: transportData.producerIceParameters,
        iceCandidates: transportData.producerIceCandidates,
        dtlsParameters: transportData.producerDtlsParameters,
      });
      producerTransportRef.current.on(
        "connect",
        async ({ dtlsParameters }, callback, errback) => {
          socket.emit("transport-connect", { dtlsParameters }, () => {
            callback();
          });
        }
      );
      producerTransportRef.current.on(
        "produce",
        async ({ kind, rtpParameters, appData }, callback, errback) => {
          socket.emit(
            "transport-produce",
            { kind, rtpParameters, appData },
            (producerId) => {
              callback({ id: producerId });
            }
          );
        }
      );

      // 5. Start producing the local video track.
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
      console.error("Error setting up transports:", error);
    }
  };

  // Consume a peer's video stream.
  const consumePeer = (producerPeerId) => {
    if (!consumerTransportRef.current) {
      console.error("Consumer transport not established yet.");
      return;
    }
    // Request consumer parameters from the server.
    socket.emit(
      "consume",
      { roomId, producerPeerId, consumerId: peerIdRef.current },
      async (consumerParams) => {
        try {
          const consumer = await consumerTransportRef.current.consume({
            id: consumerParams.id,
            producerId: consumerParams.producerId,
            kind: consumerParams.kind,
            rtpParameters: consumerParams.rtpParameters,
          });
          // Create a MediaStream and add the consumer's track.
          const stream = new MediaStream();
          stream.addTrack(consumer.track);
          setRemoteStreams((prev) => [...prev, { id: producerPeerId, stream }]);
        } catch (error) {
          console.error("Error consuming peer:", error);
        }
      }
    );
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
        Create &amp; Join Room
      </button>
      <div style={{ marginTop: "20px" }}>
        <h2>Your Video</h2>
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          style={{ width: "400px", border: "1px solid #ccc" }}
        />
      </div>
      <h2>Remote Videos</h2>
      <div style={{ display: "flex", flexWrap: "wrap" }}>
        {remoteStreams.map((remote) => (
          <video
            key={remote.id}
            autoPlay
            playsInline
            style={{ width: "300px", border: "1px solid #ccc", margin: "10px" }}
            ref={(videoEl) => {
              if (videoEl && remote.stream) {
                videoEl.srcObject = remote.stream;
              }
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default VideoChat;
