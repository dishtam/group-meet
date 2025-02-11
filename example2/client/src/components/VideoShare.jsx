import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import mediasoupClient from "mediasoup-client";

export default function VideoShare() {
  const [socket, setSocket] = useState(null);
  const [device, setDevice] = useState(null);
  const [rtpCapabilities, setRtpCapabilities] = useState(null);
  const [producerTransport, setProducerTransport] = useState(null);
  const [consumerTransport, serConsumerTransport] = useState(null);
  const [producer, setProducer] = useState(null);
  const [consumer, setConsumer] = useState(null);
  const [isProducer, setIsProducer] = useState(false);
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
    // https://mediasoup.org/documentation/v3/mediasoup-client/api/#ProducerCodecOptions
    codecOptions: {
      videoGoogleStartBitrate: 1000,
    },
  });

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  // connected with the socket when the component gets mounted
  useEffect(() => {
    const newSocket = io("https://localhost:3000/group-meet");

    newSocket.on("connection-success", ({ socketId, existsProducer }) => {
      console.log(socketId, existsProducer);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Event handler when produce button is clicked
  // Involves multiple steps.
  // Create Device, Get rtpCapabilities
  // create send Transport
  const getLocalStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          width: {
            min: 640,
            max: 1920,
          },
          height: {
            min: 400,
            max: 1080,
          },
        },
      });
      // await will return a promise and only after the stream
      // is received, it is assigned to the localVideoRef
      localVideoRef.current.srcObject = stream;
      const track = stream.getVideoTracks()[0];
      setParams({ track, ...params });

      createDevice(stream);
    } catch (error) {
      console.error("Error accessing media devices:", error);
    }
  };

  const createDevice = async (stream) => {
    try{
      const newDevice = mediasoupClient.Device();
      setDevice(newDevice);

      socket.emit('createRoom',(data)=>{
        console.log('Router RTP Capabilities:',data.rtpCapabilities);
        setRtpCapabilities(data.rtpCapabilities);

        newDevice.load({routerRtpCapabilities: data.rtpCapabilities})
          .then(()=>{
            console.log('Device loaded:',newDevice.rtpCapabilities);
            createSendTransport(newDevice,stream);
          })
          .catch((error)=>{
            console.log("Error creating device:",error)
          })
      })
    }
    catch(error){
      console.error('Error creating device:',error)
    }
  };

  // Event handler when consume button is clicked
  // I need to get the rtpCapabilitites, recv Transport and start consuming
  const startConsuming = () => {};

  return (
    <div className="flex flex-col h-screen">
      <div className="text-center text-4xl m-2 p-2 font-bold shadow-[0_4px_0px_0px_rgba(0,0,0,0.1)]">
        <h1>Group Meet</h1>
      </div>
      <div className="flex-grow flex">
        {/* Left half */}
        <div className="w-1/2 flex-col flex items-center justify-center p-2 m-2">
          <h2 className="text-lg p-2 m-2">Local Video</h2>
          <video
            src=""
            height={"400px"}
            width={"640px"}
            className="bg-black p-2 m-2"
            id="localVideo"
          ></video>
          <button
            onClick={getLocalStream}
            className="text-lg p-2 m-2 cursor-pointer bg-gray-500 text-white rounded transition-tranform duration-200 hover:scale-105"
          >
            Produce
          </button>
        </div>
        {/* Right half */}
        <div className="w-1/2 flex-col flex items-center justify-center p-2 m-2">
          <h2 className="text-lg p-2 m-2">Remote Video</h2>
          <video
            src=""
            height={"400px"}
            width={"640px"}
            className="bg-black p-2 m-2"
            id="remoteVideo"
          ></video>
          <button
            onClick={startConsuming}
            className="text-lg p-2 m-2 cursor-pointer bg-gray-500 text-white rounded transition-transform duration-200 hover:scale-105"
          >
            Consume
          </button>
        </div>
      </div>
    </div>
  );
}
