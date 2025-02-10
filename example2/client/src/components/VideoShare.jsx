import React from "react";

export default function VideoShare() {
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
          ></video>
          <button className="text-lg p-2 m-2 cursor-pointer bg-gray-500 text-white rounded transition-tranform duration-200 hover:scale-105">
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
          ></video>
          <button className="text-lg p-2 m-2 cursor-pointer bg-gray-500 text-white rounded transition-transform duration-200 hover:scale-105">
            Consume
          </button>
        </div>
      </div>
    </div>
  );
}
