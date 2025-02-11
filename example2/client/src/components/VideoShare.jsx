import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import mediasoupClient from "mediasoup-client";

export default function VideoShare() {
  const [socket, setSocket] = useState(null);
  const [device, setDevice] = useState(null);
  const [rtpCapabilities, setRtpCapabilities] = useState(null);
  const [producerTransport, setProducerTransport] = useState(null);
  const [consumerTransport, setConsumerTransport] = useState(null);
  const [producer, setProducer] = useState(null);
  const [consumer, setConsumer] = useState(null);

  const [params, setParams] = useState({
    encodings: [
      {
        rid: "r0",
        maxBitrate: 100000,
        scalabilityMode: "S1T3",
      },
      {
        rid: "r1",
        maxBitrate: 300000,
        scalabilityMode: "S1T3",
      },
      {
        rid: "r2",
        maxBitrate: 900000,
        scalabilityMode: "S1T3",
      },
    ],
    codecOptions: {
      videoGoogleStartBitrate: 1000,
    },
  });

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  // Connect to socket when component mounts
  useEffect(() => {
    const newSocket = io("https://localhost:3000/group-meet");

    newSocket.on("connection-success", ({ socketId, existsProducer }) => {
      console.log("Socket ID:", socketId, "Exists Producer:", existsProducer);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Get local video stream
  const getLocalStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          width: { min: 640, max: 1920 },
          height: { min: 400, max: 1080 },
        },
      });

      localVideoRef.current.srcObject = stream;
      setParams((prev) => ({ ...prev, track: stream.getVideoTracks()[0] }));

      createDevice();
    } catch (error) {
      console.error("Error accessing media devices:", error);
    }
  };

  // Create Mediasoup Device
  const createDevice = async () => {
    try {
      const newDevice = new mediasoupClient.Device();
      setDevice(newDevice);

      socket.emit("createRoom", (data) => {
        console.log("Router RTP Capabilities:", data.rtpCapabilities);
        setRtpCapabilities(data.rtpCapabilities);

        newDevice
          .load({ routerRtpCapabilities: data.rtpCapabilities })
          .then(() => {
            console.log("Device loaded successfully");
            createSendTransport(newDevice);
          })
          .catch((error) => {
            console.error("Error loading device:", error);
          });
      });
    } catch (error) {
      console.error("Error creating device:", error);
    }
  };

  // Create send transport for producing media
  const createSendTransport = (device) => {
    socket.emit("createWebRtcTransport", { sender: true }, ({ params }) => {
      if (params.error) {
        console.error("Transport creation error:", params.error);
        return;
      }

      const transport = device.createSendTransport(params);
      setProducerTransport(transport);

      transport.on("connect", async ({ dtlsParameters }, callback, errback) => {
        try {
          await socket.emit("transport-connect", { dtlsParameters });
          callback();
        } catch (error) {
          errback(error);
        }
      });

      transport.on("produce", async (parameters, callback, errback) => {
        try {
          await socket.emit(
            "transport-produce",
            {
              kind: parameters.kind,
              rtpParameters: parameters.rtpParameters,
              appData: parameters.appData,
            },
            ({ id }) => callback({ id })
          );
        } catch (error) {
          errback(error);
        }
      });

      startProducing(transport);
    });
  };

  // Start Producing Media
  const startProducing = async (transport) => {
    const track = params.track;

    if (!track) {
      console.error("No track found for producing");
      return;
    }

    const newProducer = await transport.produce({ track, ...params });
    setProducer(newProducer);

    newProducer.on("trackended", () => console.log("Track ended"));
    newProducer.on("transportclose", () => console.log("Transport closed"));
  };

  // Start consuming media
  const startConsuming = () => {
    if (!device) {
      console.error("Device not initialized");
      return;
    }

    socket.emit("createWebRtcTransport", { sender: false }, ({ params }) => {
      if (params.error) {
        console.error("Transport creation error:", params.error);
        return;
      }

      const transport = device.createRecvTransport(params);
      setConsumerTransport(transport);

      transport.on("connect", async ({ dtlsParameters }, callback, errback) => {
        try {
          await socket.emit("transport-recv-connect", { dtlsParameters });
          callback();
        } catch (error) {
          errback(error);
        }
      });

      consumeStream(transport);
    });
  };

  // Consume remote stream
  const consumeStream = async (transport) => {
    socket.emit(
      "consume",
      { rtpCapabilities: device.rtpCapabilities },
      async ({ params }) => {
        if (params.error) {
          console.error("Cannot consume media");
          return;
        }

        const newConsumer = await transport.consume({
          id: params.id,
          producerId: params.producerId,
          kind: params.kind,
          rtpParameters: params.rtpParameters,
        });

        setConsumer(newConsumer);
        remoteVideoRef.current.srcObject = new MediaStream([newConsumer.track]);

        socket.emit("consumer-resume");
      }
    );
  };

  return (
    <div className="flex flex-col h-screen">
      <div className="text-center text-4xl m-2 p-2 font-bold shadow-md">
        <h1>Group Meet</h1>
      </div>
      <div className="flex-grow flex">
        {/* Local Video */}
        <div className="w-1/2 flex flex-col items-center justify-center p-2 m-2">
          <h2 className="text-lg p-2 m-2">Local Video</h2>
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            className="bg-black p-2 m-2 w-[640px] h-[400px]"
          ></video>
          <button
            onClick={getLocalStream}
            className="p-2 m-2 bg-blue-500 text-white rounded hover:scale-105"
          >
            Produce
          </button>
        </div>
        {/* Remote Video */}
        <div className="w-1/2 flex flex-col items-center justify-center p-2 m-2">
          <h2 className="text-lg p-2 m-2">Remote Video</h2>
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="bg-black p-2 m-2 w-[640px] h-[400px]"
          ></video>
          <button
            onClick={startConsuming}
            className="p-2 m-2 bg-green-500 text-white rounded hover:scale-105"
          >
            Consume
          </button>
        </div>
      </div>
    </div>
  );
}
