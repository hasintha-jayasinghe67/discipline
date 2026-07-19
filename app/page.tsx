"use client";
import Image from "next/image";
import { createClient } from "@supabase/supabase-js";
import { useState } from "react";
import Header from "@/components/Header";
import Student from "@/components/Student";
import Modal from "@/components/Modal";

export default function Home() {
  // supabase client init - update keys with production ones before deployment
  const supabase = createClient(
    "https://kjpvfhcbnehcmyxzpurk.supabase.co",
    "sb_publishable_tLKA5vcSiHhwOuALGzFMgg_A1qyLJ3-",
  );

  const [name, setName] = useState("");

  const [studentName, setStudentName] = useState("");
  const [Class, setClass] = useState("");
  const [house, setHouse] = useState("");
  const [strikes, setStrikes] = useState(0);
  const [blackmarks, setBlackmarks] = useState(0);

  // Modals
  const [strikeModalOpen, setStrikeModalOpen] = useState(false);
  const [blackMarkModalOpen, setBlackmarkModalOpen] = useState(false);

  // strike insert fields
  const [strikeType, setStrikeType] = useState("grooming");

  // blackmark state
  const [issuer, setIssuer] = useState("");
  const [blackmarkReason, setBlackmarkReason] = useState("grooming");

  const fetchStudentData = async () => {
    const students = await supabase
      .from("students")
      .select()
      .eq("Admission No", Number(name));

    if ((students.data?.length as number) < 1) {
      setStudentName(
        "Not found (He lied to you, you're not scary, you're a lolla)",
      );
    } else {
      students.data?.map((s) => {
        setClass(s.Class);
        setStudentName(s["Name with Initials"]);
        setHouse(s["School House"]);
      });

      const strks = await supabase
        .from("strikes")
        .select()
        .eq("Admission No", Number(name));
      setStrikes(strks.data?.length as number);

      const bms = await supabase
        .from("blackmarks")
        .select()
        .eq("Admission No", Number(name));
      setBlackmarks(bms.data?.length as number);
    }
  };

  return (
    <>
      <Header />
      <div className="grid grid-cols-2 p-3 h-full">
        <div className="">
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
            }}
            className="p-1 bg-gray-200 text-black"
          />
          <button className="bg-green-500 p-1" onClick={fetchStudentData}>
            Search
          </button>

          <Student
            name={studentName}
            Class={Class}
            house={house}
            strikes={strikes}
            onStrikeClick={() => setStrikeModalOpen(true)}
            onBlackmarkClick={() => setBlackmarkModalOpen(true)}
            blackmarks={blackmarks}
          />
        </div>
        <div className="bg-white">
          <div className="flex justify-around w-full">
            <h1 className="text-2xl text-black">Punishments ongoing</h1>
            <button className="bg-green-400 text-white p-1">Add</button>
          </div>
        </div>
      </div>
      <Modal
        isOpen={blackMarkModalOpen}
        onClose={() => {
          setBlackmarkModalOpen(false);
        }}
        title={`Add black mark to student ${name}`}
      >
        <h1>Add black mark to student {name}</h1>
        <h3>Strikes: {strikes}</h3>
        <div className="flex flex-col">
          <label htmlFor="cateogory">Reason</label>
          <select
            name="cateogory"
            id=""
            value={blackmarkReason}
            onChange={(e) => setBlackmarkReason(e.target.value)}
          >
            <option value="grooming">Personal Grooming</option>
            <option value="repeated-punish">Repeated punishment</option>
            <option value="bullying">Bullying</option>
            <option value="late">Getting Late Often</option>
            <option value="substances">Substances</option>
            <option value="classfuckup">Class Fuckup</option>
            <option value="clubbing">Clubbing</option>
          </select>
          <div className="">
            <label htmlFor="issuer">Issued By</label>
            <input
              value={issuer}
              onChange={(e) => setIssuer(e.target.value)}
              type="text"
              id="issuer"
            />
          </div>
        </div>
        <div className="flex w-full justify-evenly">
          <button
            className="bg-green-500 text-white p-1"
            onClick={async () => {
              console.log("entering");
              console.log(name, blackmarkReason, issuer);
              await supabase.from("blackmarks").insert({
                "Admission No": Number(name),
                Reason: blackmarkReason,
                issuedBy: issuer,
              });

              console.log("done");

              setBlackmarkModalOpen(false);
              fetchStudentData();
            }}
          >
            Save
          </button>
          <button
            className="bg-red-500 text-white p-1"
            onClick={() => setBlackmarkModalOpen(false)}
          >
            Discard
          </button>
        </div>
      </Modal>
      <Modal
        isOpen={strikeModalOpen}
        onClose={() => {
          setStrikeModalOpen(false);
        }}
        title={`Add strike to student ${name}`}
      >
        <h1>Add Strike to student {name}</h1>
        <label htmlFor="cateogory">Category</label>
        <select
          name="cateogory"
          id=""
          value={strikeType}
          onChange={(e) => setStrikeType(e.target.value)}
        >
          <option value="grooming">Personal Grooming</option>
          <option value="repeated-punish">Repeated punishment</option>
          <option value="bullying">Bullying</option>
          <option value="late">Getting Late Often</option>
          <option value="substances">Substances</option>
          <option value="classfuckup">Class Fuckup</option>
          <option value="clubbing">Clubbing</option>
        </select>
        <div className="flex w-full justify-evenly">
          <button
            className="bg-green-500 text-white p-1"
            onClick={async () => {
              await supabase.from("strikes").insert({
                "Admission No": Number(name),
                Category: strikeType,
              });

              setStrikeModalOpen(false);
              fetchStudentData();
            }}
          >
            Save
          </button>
          <button
            className="bg-red-500 text-white p-1"
            onClick={() => setStrikeModalOpen(false)}
          >
            Discard
          </button>
        </div>
      </Modal>
    </>
  );
}
