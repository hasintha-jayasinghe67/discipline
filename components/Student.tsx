import React from "react";

export default ({
  name,
  Class,
  house,
  strikes,
  onStrikeClick,
  onBlackmarkClick,
  blackmarks,
}: {
  name: string;
  Class: string;
  house: string;
  strikes: number | string;
  blackmarks: number | string;
  onStrikeClick: () => void;
  onBlackmarkClick: () => void;
}) => {
  return (
    <div className="p-2 m-1 text-white bg-gray-500">
      <div className="grid grid-cols-2">
        <div className="flex flex-col">
          <h1>{name}</h1>
          <h1>{Class}</h1>
          <h1>{house}</h1>
        </div>
        <div>
          <h1>Current Strikes: {strikes}</h1>
          <h1>Current Blackmarks: {blackmarks}</h1>
        </div>
      </div>
      <div className="flex">
        <button
          onClick={onStrikeClick}
          className="hover:cursor-pointer bg-yellow-400 text-white p-1 m-1"
        >
          Add Strike
        </button>
        <button className="hover:cursor-pointer bg-yellow-600 text-white p-1 m-1">
          Add to Punishment
        </button>
        <button
          onClick={onBlackmarkClick}
          className="hover:cursor-pointer bg-red-400 text-white p-1 m-1"
        >
          Add Black Mark
        </button>
      </div>
    </div>
  );
};
