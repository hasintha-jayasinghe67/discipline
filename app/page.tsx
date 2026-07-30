"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import Header from "@/components/Header";
import Student from "@/components/Student";
import Modal from "@/components/Modal";

export default function Home() {
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
      <div className="p-6 bg-gray-50">
        <div className="max-w-2xl mx-auto flex flex-col gap-3">
          <div className="flex items-center gap-2 bg-white rounded-xl shadow-sm border border-gray-100 p-3">
            <div className="relative flex-1">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                }}
                placeholder="Enter Admission No"
                className="w-full pl-10 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:border-indigo-400 focus:bg-white"
              />
            </div>
            <button
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-5 py-2.5 rounded-lg shadow-sm"
              onClick={fetchStudentData}
            >
              Search
            </button>
          </div>
          {studentName ? (
            <Student
              admission={name}
              name={studentName}
              Class={Class}
              house={house}
              strikes={strikes}
              onStrikeClick={() => setStrikeModalOpen(true)}
              onBlackmarkClick={() => setBlackmarkModalOpen(true)}
              blackmarks={blackmarks}
            />
          ) : (
            <></>
          )}
        </div>
        {/* Punishments section commented out for now */}
        {/* <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold text-gray-900">
              Punishments ongoing
            </h1>
            <button className="bg-emerald-500 hover:bg-emerald-600 text-white font-medium text-sm px-4 py-2 rounded-lg shadow-sm flex items-center gap-1.5">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Add
            </button>
          </div>
        </div> */}
      </div>
      <Modal
        isOpen={blackMarkModalOpen}
        onClose={() => {
          setBlackmarkModalOpen(false);
        }}
        title={`Add black mark to student ${name}`}
      >
        <div className="text-sm text-gray-500 mb-3">
          Adding black mark to student{" "}
          <span className="font-semibold text-gray-700">{name}</span>
        </div>
        <div className="inline-flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 mb-4">
          <span className="text-sm text-rose-700 font-medium">
            Current Strikes
          </span>
          <span className="text-lg font-bold text-rose-600">{strikes}</span>
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <label
              htmlFor="blackmark-reason"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Reason
            </label>
            <select
              name="cateogory"
              id="blackmark-reason"
              value={blackmarkReason}
              onChange={(e) => setBlackmarkReason(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-gray-900 focus:border-indigo-400 focus:bg-white"
            >
              <option value="grooming">Personal Grooming</option>
              <option value="repeated-punish">Repeated punishment</option>
              <option value="bullying">Bullying</option>
              <option value="late">Getting Late Often</option>
              <option value="substances">Substances</option>
              <option value="classfuckup">Class Fuckup</option>
              <option value="clubbing">Clubbing</option>
            </select>
          </div>
          <div>
            <label
              htmlFor="issuer"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Issued By
            </label>
            <input
              value={issuer}
              onChange={(e) => setIssuer(e.target.value)}
              type="text"
              id="issuer"
              placeholder="Enter your name"
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:border-indigo-400 focus:bg-white"
            />
          </div>
        </div>
        <div className="flex w-full gap-2 mt-5 pt-4 border-t border-gray-100">
          <button
            className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-medium px-4 py-2.5 rounded-lg shadow-sm"
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
            className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium px-4 py-2.5 rounded-lg"
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
        <div className="text-sm text-gray-500 mb-4">
          Adding strike to student{" "}
          <span className="font-semibold text-gray-700">{name}</span>
        </div>
        <div>
          <label
            htmlFor="strike-category"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Category
          </label>
          <select
            name="cateogory"
            id="strike-category"
            value={strikeType}
            onChange={(e) => setStrikeType(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-gray-900 focus:border-indigo-400 focus:bg-white"
          >
            <option value="grooming">Personal Grooming</option>
            <option value="repeated-punish">Repeated punishment</option>
            <option value="bullying">Bullying</option>
            <option value="late">Getting Late Often</option>
            <option value="substances">Substances</option>
            <option value="classfuckup">Class Fuckup</option>
            <option value="clubbing">Clubbing</option>
          </select>
        </div>
        <div className="flex w-full gap-2 mt-5 pt-4 border-t border-gray-100">
          <button
            className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-medium px-4 py-2.5 rounded-lg shadow-sm"
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
            className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium px-4 py-2.5 rounded-lg"
            onClick={() => setStrikeModalOpen(false)}
          >
            Discard
          </button>
        </div>
      </Modal>
    </>
  );
}
