"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import Header from "@/components/Header";
import Modal from "@/components/Modal";

const categoryLabels: Record<string, string> = {
  grooming: "Personal Grooming",
  "repeated-punish": "Repeated Punishments",
  bullying: "Bullying",
  late: "Getting Late Often",
  substances: "Substances",
  classfuckup: "Classroom Behavior",
  clubbing: "Clubbing",
  "good-behavior": "Good Behavior",
  "giving-back": "Giving Back to College",
  "excellent-academics": "Excellent Academics",
};

interface Strike {
  Category: string;
  created_at?: string;
}

interface Blackmark {
  Reason: string;
  issuedBy: string;
  created_at?: string;
}

interface Goldmark {
  Reason: string;
  issuedBy: string;
  created_at?: string;
}

interface Comment {
  id: number;
  "Admission No": number;
  commentor: string;
  commentText: string;
  created_at?: string;
}

export default function StudentDetailPage() {
  const { authenticated } = useAuth();
  const router = useRouter();
  const params = useParams();
  const admissionNo = params.admissionNo as string;

  const [studentName, setStudentName] = useState("");

  useEffect(() => {
    if (!authenticated) {
      router.push("/authenticate");
    }
  }, [authenticated, router]);

  const [Class, setClass] = useState("");
  const [house, setHouse] = useState("");
  const [strikes, setStrikes] = useState<Strike[]>([]);
  const [blackmarks, setBlackmarks] = useState<Blackmark[]>([]);
  const [goldmarks, setGoldmarks] = useState<Goldmark[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Modal states
  const [strikeModalOpen, setStrikeModalOpen] = useState(false);
  const [blackMarkModalOpen, setBlackmarkModalOpen] = useState(false);
  const [goldMarkModalOpen, setGoldMarkModalOpen] = useState(false);
  const [punishmentModalOpen, setPunishmentModalOpen] = useState(false);
  const [commentModalOpen, setCommentModalOpen] = useState(false);

  // Form field states
  const [strikeType, setStrikeType] = useState("grooming");
  const [issuer, setIssuer] = useState("");
  const [blackmarkReason, setBlackmarkReason] = useState("grooming");
  const [goldMarkReason, setGoldMarkReason] = useState("good-behavior");
  const [punishmentReason, setPunishmentReason] = useState("");
  const [commentor, setCommentor] = useState("");
  const [commentText, setCommentText] = useState("");

  const fetchData = async () => {
    setLoading(true);

    const { data: students } = await supabase
      .from("students")
      .select()
      .eq("Admission No", Number(admissionNo));

    if (!students || students.length < 1) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    const s = students[0];
    setStudentName(s["Name with Initials"]);
    setClass(s.Class);
    setHouse(s["School House"]);

    const { data: strikesData } = await supabase
      .from("strikes")
      .select()
      .eq("Admission No", Number(admissionNo));

    setStrikes(strikesData || []);

    const { data: blackmarksData } = await supabase
      .from("blackmarks")
      .select()
      .eq("Admission No", Number(admissionNo));

    setBlackmarks(blackmarksData || []);

    const { data: goldmarksData } = await supabase
      .from("goldmarks")
      .select()
      .eq("Admission No", Number(admissionNo));

    setGoldmarks(goldmarksData || []);

    const { data: commentsData } = await supabase
      .from("comments")
      .select()
      .eq("Admission No", Number(admissionNo));

    setComments(commentsData || []);
    setLoading(false);
  };

  useEffect(() => {
    if (admissionNo) fetchData();
  }, [admissionNo]);

  const handleAddStrike = async () => {
    await supabase.from("strikes").insert({
      "Admission No": Number(admissionNo),
      Category: strikeType,
    });
    setStrikeModalOpen(false);
    fetchData();
  };

  const handleAddBlackmark = async () => {
    await supabase.from("blackmarks").insert({
      "Admission No": Number(admissionNo),
      Reason: blackmarkReason,
      issuedBy: issuer,
    });
    setBlackmarkModalOpen(false);
    fetchData();
  };

  const handleAddGoldMark = async () => {
    await supabase.from("goldmarks").insert({
      "Admission No": Number(admissionNo),
      Reason: goldMarkReason,
      issuedBy: issuer,
    });
    setGoldMarkModalOpen(false);
    fetchData();
  };

  const handleAddPunishment = async () => {
    // Placeholder for punishment logic - add to a punishments table when ready
    setPunishmentModalOpen(false);
  };

  const handleAddComment = async () => {
    await supabase.from("comments").insert({
      "Admission No": Number(admissionNo),
      commentor: commentor,
      commentText: commentText,
    });
    setCommentModalOpen(false);
    setCommentText("");
    fetchData();
  };

  if (!authenticated) return null;

  if (loading) {
    return (
      <>
        <Header />
        <div className="p-4 sm:p-6 bg-gray-50 min-h-screen flex items-center justify-center">
          <div className="text-gray-400 text-base sm:text-lg animate-pulse">
            Loading student data...
          </div>
        </div>
      </>
    );
  }

  if (notFound) {
    return (
      <>
        <Header />
        <div className="p-4 sm:p-6 bg-gray-50 min-h-screen">
          <div className="max-w-2xl mx-auto mt-8 sm:mt-12 bg-white rounded-xl shadow-sm border border-gray-100 p-6 sm:p-8 text-center">
            <div className="text-4xl sm:text-6xl mb-4">🔍</div>
            <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-2">
              Student Not Found
            </h2>
            <p className="text-sm sm:text-base text-gray-500">
              No student found with Admission No:{" "}
              <span className="font-semibold text-gray-700">{admissionNo}</span>
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="p-4 sm:p-6 bg-gray-50 min-h-screen">
        <div className="max-w-3xl mx-auto flex flex-col gap-4 sm:gap-6">
          {/* Back link */}
          <a
            href="/"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-gray-500 hover:text-indigo-600 transition-colors w-fit"
          >
            <svg
              className="w-3.5 h-3.5 sm:w-4 sm:h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to search
          </a>
          {/* Student Info Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3 sm:gap-4 mb-4 text-center sm:text-left">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-indigo-500 to-blue-500 rounded-full flex items-center justify-center text-white text-lg sm:text-xl font-bold shrink-0">
                {studentName.charAt(0)}
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                  {studentName}
                </h1>
                <p className="text-gray-500 flex flex-wrap items-center justify-center sm:justify-start gap-x-2 gap-y-1 mt-1 text-xs sm:text-sm">
                  <span>Admission: {admissionNo}</span>
                  <span className="text-gray-300 hidden sm:inline">|</span>
                  <span className="hidden sm:inline">{Class}</span>
                  <span className="text-gray-300 hidden sm:inline">|</span>
                  <span className="hidden sm:inline">{house}</span>
                </p>
                {/* Mobile-only class/house row */}
                <p className="text-gray-500 flex items-center justify-center sm:hidden gap-2 mt-1 text-xs">
                  <span>{Class}</span>
                  <span className="text-gray-300">•</span>
                  <span>{house}</span>
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-4 pt-4 border-t border-gray-100">
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-2 sm:px-4 py-2 sm:py-3 text-center">
                <div className="text-lg sm:text-2xl font-bold text-amber-600">
                  {strikes.length}
                </div>
                <div className="text-[10px] sm:text-sm text-amber-700 font-medium leading-tight sm:leading-normal">
                  Strikes
                </div>
              </div>
              <div className="bg-rose-50 border border-rose-200 rounded-lg px-2 sm:px-4 py-2 sm:py-3 text-center">
                <div className="text-lg sm:text-2xl font-bold text-rose-600">
                  {blackmarks.length}
                </div>
                <div className="text-[10px] sm:text-sm text-rose-700 font-medium leading-tight sm:leading-normal">
                  Blackmarks
                </div>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-2 sm:px-4 py-2 sm:py-3 text-center">
                <div className="text-lg sm:text-2xl font-bold text-emerald-600">
                  {goldmarks.length}
                </div>
                <div className="text-[10px] sm:text-sm text-emerald-700 font-medium leading-tight sm:leading-normal">
                  Gold Marks
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 sm:flex sm:gap-2 gap-2 mt-4 pt-4 border-t border-gray-100">
              <button
                onClick={() => setStrikeModalOpen(true)}
                className="sm:flex-1 hover:cursor-pointer bg-amber-500 hover:bg-amber-600 text-white font-medium text-xs sm:text-sm px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg shadow-sm transition-all"
              >
                <span className="flex items-center justify-center gap-1 sm:gap-1.5">
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Strike
                </span>
              </button>
              <button
                onClick={() => setGoldMarkModalOpen(true)}
                className="sm:flex-1 hover:cursor-pointer bg-emerald-500 hover:bg-emerald-600 text-white font-medium text-xs sm:text-sm px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg shadow-sm transition-all"
              >
                <span className="flex items-center justify-center gap-1 sm:gap-1.5">
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6m0 2a2 2 0 100-4 2 2 0 000 4zm-6 8a6 6 0 0112 0" />
                  </svg>
                  Gold Mark
                </span>
              </button>
              <button
                onClick={() => setPunishmentModalOpen(true)}
                className="sm:flex-1 hover:cursor-pointer bg-blue-500 hover:bg-blue-600 text-white font-medium text-xs sm:text-sm px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg shadow-sm transition-all"
              >
                <span className="flex items-center justify-center gap-1 sm:gap-1.5">
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                  Punishment
                </span>
              </button>
              <button
                onClick={() => setBlackmarkModalOpen(true)}
                className="sm:flex-1 hover:cursor-pointer bg-rose-500 hover:bg-rose-600 text-white font-medium text-xs sm:text-sm px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg shadow-sm transition-all"
              >
                <span className="flex items-center justify-center gap-1 sm:gap-1.5">
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Black Mark
                </span>
              </button>
              <button
                onClick={() => { setCommentModalOpen(true); setCommentor(""); setCommentText(""); }}
                className="sm:flex-1 hover:cursor-pointer bg-violet-500 hover:bg-violet-600 text-white font-medium text-xs sm:text-sm px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg shadow-sm transition-all"
              >
                <span className="flex items-center justify-center gap-1 sm:gap-1.5">
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  Comment
                </span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Strikes List */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-amber-400 rounded-full"></span>
                Strikes
              </h2>
              {strikes.length === 0 ? (
                <p className="text-gray-400 text-sm py-4 text-center">
                  No strikes recorded
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {strikes.map((strike, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2.5"
                    >
                      <span className="w-6 h-6 bg-amber-200 rounded-full flex items-center justify-center text-amber-700 text-xs font-bold">
                        {i + 1}
                      </span>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-amber-900">
                          {categoryLabels[strike.Category] || strike.Category}
                        </div>
                        {strike.created_at && (
                          <div className="text-xs text-amber-600">
                            {new Date(strike.created_at).toLocaleDateString(
                              "en-US",
                              {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              }
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Blackmarks List */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-rose-400 rounded-full"></span>
                Blackmarks
              </h2>
              {blackmarks.length === 0 ? (
                <p className="text-gray-400 text-sm py-4 text-center">
                  No blackmarks recorded
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {blackmarks.map((bm, i) => (
                    <div
                      key={i}
                      className="flex flex-col gap-1 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2.5"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 bg-rose-200 rounded-full flex items-center justify-center text-rose-700 text-xs font-bold shrink-0">
                          {i + 1}
                        </span>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-rose-900">
                            {categoryLabels[bm.Reason] || bm.Reason}
                          </div>
                          <div className="text-xs text-rose-600">
                            Issued by: {bm.issuedBy}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Gold Marks List */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>
                Gold Marks
              </h2>
              {goldmarks.length === 0 ? (
                <p className="text-gray-400 text-sm py-4 text-center">
                  No gold marks recorded
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {goldmarks.map((gm, i) => (
                    <div
                      key={i}
                      className="flex flex-col gap-1 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2.5"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 bg-emerald-200 rounded-full flex items-center justify-center text-emerald-700 text-xs font-bold shrink-0">
                          {i + 1}
                        </span>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-emerald-900">
                            {categoryLabels[gm.Reason] || gm.Reason}
                          </div>
                          <div className="text-xs text-emerald-600">
                            Issued by: {gm.issuedBy}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Comments Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Comments ({comments.length})
            </h2>
            {comments.length === 0 ? (
              <p className="text-gray-400 text-sm py-4 text-center">
                No comments yet
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {comments.map((comment, i) => (
                  <div
                    key={comment.id || i}
                    className="bg-violet-50 border border-violet-100 rounded-lg px-4 py-3"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-violet-200 rounded-full flex items-center justify-center text-violet-700 text-xs font-bold">
                          {comment.commentor?.charAt(0)?.toUpperCase() || "?"}
                        </div>
                        <span className="text-sm font-medium text-violet-900">
                          {comment.commentor}
                        </span>
                      </div>
                      {comment.created_at && (
                        <span className="text-xs text-violet-500">
                          {new Date(comment.created_at).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-violet-800 ml-8">
                      {comment.commentText}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Strike Modal */}
      <Modal
        isOpen={strikeModalOpen}
        onClose={() => setStrikeModalOpen(false)}
        title={`Add strike to student ${studentName}`}
      >
        <div className="text-sm text-gray-500 mb-4">
          Adding strike to{" "}
          <span className="font-semibold text-gray-700">{studentName}</span>
        </div>
        <div>
          <label htmlFor="detail-strike-category" className="block text-sm font-medium text-gray-700 mb-1">
            Category
          </label>
          <select
            id="detail-strike-category"
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
            className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-medium px-4 py-2.5 rounded-lg shadow-sm transition-all"
            onClick={handleAddStrike}
          >
            Save
          </button>
          <button
            className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium px-4 py-2.5 rounded-lg transition-all"
            onClick={() => setStrikeModalOpen(false)}
          >
            Discard
          </button>
        </div>
      </Modal>

      {/* Blackmark Modal */}
      <Modal
        isOpen={blackMarkModalOpen}
        onClose={() => setBlackmarkModalOpen(false)}
        title={`Add black mark to student ${studentName}`}
      >
        <div className="text-sm text-gray-500 mb-3">
          Adding black mark to{" "}
          <span className="font-semibold text-gray-700">{studentName}</span>
        </div>
        <div className="inline-flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 mb-4">
          <span className="text-sm text-rose-700 font-medium">Current Strikes</span>
          <span className="text-lg font-bold text-rose-600">{strikes.length}</span>
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <label htmlFor="detail-bm-reason" className="block text-sm font-medium text-gray-700 mb-1">
              Reason
            </label>
            <select
              id="detail-bm-reason"
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
            <label htmlFor="detail-issuer" className="block text-sm font-medium text-gray-700 mb-1">
              Issued By
            </label>
            <input
              value={issuer}
              onChange={(e) => setIssuer(e.target.value)}
              type="text"
              id="detail-issuer"
              placeholder="Enter your name"
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:border-indigo-400 focus:bg-white"
            />
          </div>
        </div>
        <div className="flex w-full gap-2 mt-5 pt-4 border-t border-gray-100">
          <button
            className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-medium px-4 py-2.5 rounded-lg shadow-sm transition-all"
            onClick={handleAddBlackmark}
          >
            Save
          </button>
          <button
            className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium px-4 py-2.5 rounded-lg transition-all"
            onClick={() => setBlackmarkModalOpen(false)}
          >
            Discard
          </button>
        </div>
      </Modal>

      {/* Gold Mark Modal */}
      <Modal
        isOpen={goldMarkModalOpen}
        onClose={() => setGoldMarkModalOpen(false)}
        title={`Add gold mark to student ${studentName}`}
      >
        <div className="text-sm text-gray-500 mb-3">
          Adding gold mark to{" "}
          <span className="font-semibold text-gray-700">{studentName}</span>
        </div>
        <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 mb-4">
          <span className="text-sm text-emerald-700 font-medium">Current Gold Marks</span>
          <span className="text-lg font-bold text-emerald-600">{goldmarks.length}</span>
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <label htmlFor="detail-gm-reason" className="block text-sm font-medium text-gray-700 mb-1">
              Reason
            </label>
            <select
              id="detail-gm-reason"
              value={goldMarkReason}
              onChange={(e) => setGoldMarkReason(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-gray-900 focus:border-indigo-400 focus:bg-white"
            >
              <option value="good-behavior">Good Behavior</option>
              <option value="giving-back">Giving Back to College</option>
              <option value="excellent-academics">Excellent Academics</option>
            </select>
          </div>
          <div>
            <label htmlFor="detail-gm-issuer" className="block text-sm font-medium text-gray-700 mb-1">
              Issued By
            </label>
            <input
              value={issuer}
              onChange={(e) => setIssuer(e.target.value)}
              type="text"
              id="detail-gm-issuer"
              placeholder="Enter your name"
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:border-indigo-400 focus:bg-white"
            />
          </div>
        </div>
        <div className="flex w-full gap-2 mt-5 pt-4 border-t border-gray-100">
          <button
            className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-medium px-4 py-2.5 rounded-lg shadow-sm transition-all"
            onClick={handleAddGoldMark}
          >
            Save
          </button>
          <button
            className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium px-4 py-2.5 rounded-lg transition-all"
            onClick={() => setGoldMarkModalOpen(false)}
          >
            Discard
          </button>
        </div>
      </Modal>

      {/* Punishment Modal */}
      <Modal
        isOpen={punishmentModalOpen}
        onClose={() => setPunishmentModalOpen(false)}
        title={`Add to punishment - ${studentName}`}
      >
        <div className="text-sm text-gray-500 mb-4">
          Assigning punishment to{" "}
          <span className="font-semibold text-gray-700">{studentName}</span>
        </div>
        <div>
          <label htmlFor="detail-punishment-reason" className="block text-sm font-medium text-gray-700 mb-1">
            Punishment Reason
          </label>
          <textarea
            id="detail-punishment-reason"
            value={punishmentReason}
            onChange={(e) => setPunishmentReason(e.target.value)}
            placeholder="Describe the punishment..."
            rows={3}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:border-indigo-400 focus:bg-white resize-none"
          />
        </div>
        <div className="flex w-full gap-2 mt-5 pt-4 border-t border-gray-100">
          <button
            className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-medium px-4 py-2.5 rounded-lg shadow-sm transition-all"
            onClick={handleAddPunishment}
          >
            Save
          </button>
          <button
            className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium px-4 py-2.5 rounded-lg transition-all"
            onClick={() => setPunishmentModalOpen(false)}
          >
            Discard
          </button>
        </div>
      </Modal>

      {/* Comment Modal */}
      <Modal
        isOpen={commentModalOpen}
        onClose={() => setCommentModalOpen(false)}
        title={`Add comment for ${studentName}`}
      >
        <div className="text-sm text-gray-500 mb-3">
          Adding comment for{" "}
          <span className="font-semibold text-gray-700">{studentName}</span>
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <label htmlFor="detail-commentor" className="block text-sm font-medium text-gray-700 mb-1">
              Commentor
            </label>
            <input
              value={commentor}
              onChange={(e) => setCommentor(e.target.value)}
              type="text"
              id="detail-commentor"
              placeholder="Your name"
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:border-indigo-400 focus:bg-white"
            />
          </div>
          <div>
            <label htmlFor="detail-comment-text" className="block text-sm font-medium text-gray-700 mb-1">
              Comment
            </label>
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              id="detail-comment-text"
              placeholder="Write your comment..."
              rows={3}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:border-indigo-400 focus:bg-white resize-none"
            />
          </div>
        </div>
        <div className="flex w-full gap-2 mt-5 pt-4 border-t border-gray-100">
          <button
            className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-medium px-4 py-2.5 rounded-lg shadow-sm transition-all"
            onClick={handleAddComment}
          >
            Save
          </button>
          <button
            className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium px-4 py-2.5 rounded-lg transition-all"
            onClick={() => setCommentModalOpen(false)}
          >
            Discard
          </button>
        </div>
      </Modal>
    </>
  );
}
