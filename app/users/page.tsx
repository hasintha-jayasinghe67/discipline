"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth, type UserInfo } from "@/lib/AuthContext";
import Header from "@/components/Header";
import Modal from "@/components/Modal";

interface DbUser {
  id: number;
  username: string;
  password: string;
  role: "admin" | "view-only";
  created_at: string;
}

export default function UsersPage() {
  const { authenticated, user: currentUser } = useAuth();
  const router = useRouter();

  const [users, setUsers] = useState<DbUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Add user form
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "view-only">("view-only");
  const [adding, setAdding] = useState(false);

  // Edit user modal
  const [editUser, setEditUser] = useState<DbUser | null>(null);
  const [editUsername, setEditUsername] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editRole, setEditRole] = useState<"admin" | "view-only">("view-only");
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    if (!authenticated) {
      router.push("/authenticate");
    }
  }, [authenticated, router]);

  useEffect(() => {
    if (authenticated && currentUser?.role !== "admin") {
      router.push("/");
    }
  }, [authenticated, currentUser, router]);

  const fetchUsers = async () => {
    setLoading(true);
    const { data } = await supabase.from("users").select("*").order("username", { ascending: true });
    setUsers(data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (authenticated && currentUser?.role === "admin") {
      fetchUsers();
    }
  }, [authenticated, currentUser]);

  const handleAddUser = async () => {
    if (!newUsername.trim() || !newPassword.trim()) return;
    setAdding(true);
    try {
      const bcryptjs = await import("bcryptjs");
      const hash = bcryptjs.hashSync(newPassword, 10);
      const { error } = await supabase.from("users").insert({
        username: newUsername.trim(),
        password: hash,
        role: newRole,
      });
      if (error) {
        alert(error.message.includes("duplicate") ? "Username already exists" : error.message);
        return;
      }
      setNewUsername("");
      setNewPassword("");
      setNewRole("view-only");
      await fetchUsers();
    } catch (err) {
      alert("Failed to add user: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setAdding(false);
    }
  };

  const openEditModal = (user: DbUser) => {
    setEditUser(user);
    setEditUsername(user.username);
    setEditPassword("");
    setEditRole(user.role);
  };

  const handleSaveEdit = async () => {
    if (!editUser) return;
    setSavingEdit(true);
    try {
      const update: Partial<{ username: string; password: string; role: string }> = {
        username: editUsername.trim(),
        role: editRole,
      };
      if (editPassword.trim()) {
        const bcryptjs = await import("bcryptjs");
        update.password = bcryptjs.hashSync(editPassword, 10);
      }
      const { error } = await supabase.from("users").update(update).eq("id", editUser.id);
      if (error) {
        alert(error.message.includes("duplicate") ? "Username already exists" : error.message);
        return;
      }
      setEditUser(null);
      await fetchUsers();
    } catch (err) {
      alert("Failed to update user: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteUser = async (targetUser: DbUser) => {
    // Prevent self-deletion
    if (targetUser.id === currentUser?.id) {
      alert("You cannot delete your own account.");
      return;
    }
    // Prevent deleting the last admin
    if (targetUser.role === "admin") {
      const adminCount = users.filter((u) => u.role === "admin" && u.id !== targetUser.id).length;
      if (adminCount === 0) {
        alert("At least one admin must remain in the system.");
        return;
      }
    }
    if (!confirm(`Are you sure you want to delete user "${targetUser.username}"?`)) return;

    const { error } = await supabase.from("users").delete().eq("id", targetUser.id);
    if (error) {
      alert("Failed to delete user: " + error.message);
      return;
    }
    await fetchUsers();
  };

  if (!authenticated) return null;
  if (currentUser?.role !== "admin") return null;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <>
      <Header />
      <div className="p-4 sm:p-6 bg-gray-50 min-h-screen">
        <div className="max-w-3xl mx-auto flex flex-col gap-4 sm:gap-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">User Management</h1>
            <p className="text-sm text-gray-500 mt-0.5">Add, edit, or delete users</p>
          </div>

          {/* Add User Form */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Add New User</h2>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
              <div className="flex-1">
                <label htmlFor="new-username" className="block text-xs font-medium text-gray-600 mb-1">
                  Username
                </label>
                <input
                  id="new-username"
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="Username"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-400 focus:bg-white"
                />
              </div>
              <div className="flex-1">
                <label htmlFor="new-password" className="block text-xs font-medium text-gray-600 mb-1">
                  Password
                </label>
                <input
                  id="new-password"
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-400 focus:bg-white"
                />
              </div>
              <div className="w-full sm:w-32">
                <label htmlFor="new-role" className="block text-xs font-medium text-gray-600 mb-1">
                  Role
                </label>
                <select
                  id="new-role"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as "admin" | "view-only")}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:border-indigo-400 focus:bg-white"
                >
                  <option value="admin">Admin</option>
                  <option value="view-only">View-only</option>
                </select>
              </div>
              <button
                onClick={handleAddUser}
                disabled={adding || !newUsername.trim() || !newPassword.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-medium px-5 py-2 rounded-lg text-sm shadow-sm transition-all whitespace-nowrap"
              >
                {adding ? "Adding..." : "Add User"}
              </button>
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-gray-400 text-sm animate-pulse">Loading users...</div>
            ) : users.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-4xl mb-3">👤</div>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">No users yet</h2>
                <p className="text-sm text-gray-500">Add the first user above.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Username</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Role</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Created</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {u.username}
                        {u.id === currentUser?.id && (
                          <span className="ml-2 text-[10px] bg-indigo-100 text-indigo-700 font-semibold px-1.5 py-0.5 rounded-full">You</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                          u.role === "admin" ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-600"
                        }`}>
                          {u.role === "admin" ? "Admin" : "View-only"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{formatDate(u.created_at)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditModal(u)}
                            className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u)}
                            className="text-xs font-medium text-red-500 hover:text-red-700 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Edit User Modal */}
      <Modal
        isOpen={editUser !== null}
        onClose={() => setEditUser(null)}
        title={`Edit user: ${editUser?.username || ""}`}
      >
        <div className="flex flex-col gap-3">
          <div>
            <label htmlFor="edit-username" className="block text-sm font-medium text-gray-700 mb-1">
              Username
            </label>
            <input
              id="edit-username"
              type="text"
              value={editUsername}
              onChange={(e) => setEditUsername(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-gray-900 focus:border-indigo-400 focus:bg-white"
            />
          </div>
          <div>
            <label htmlFor="edit-password" className="block text-sm font-medium text-gray-700 mb-1">
              New password <span className="text-gray-400 font-normal">(leave blank to keep current)</span>
            </label>
            <input
              id="edit-password"
              type="text"
              value={editPassword}
              onChange={(e) => setEditPassword(e.target.value)}
              placeholder="Leave blank to keep current"
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:border-indigo-400 focus:bg-white"
            />
          </div>
          <div>
            <label htmlFor="edit-role" className="block text-sm font-medium text-gray-700 mb-1">
              Role
            </label>
            <select
              id="edit-role"
              value={editRole}
              onChange={(e) => setEditRole(e.target.value as "admin" | "view-only")}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-gray-900 focus:border-indigo-400 focus:bg-white"
            >
              <option value="admin">Admin</option>
              <option value="view-only">View-only</option>
            </select>
          </div>
        </div>
        <div className="flex w-full gap-2 mt-5 pt-4 border-t border-gray-100">
          <button
            onClick={handleSaveEdit}
            disabled={savingEdit || !editUsername.trim()}
            className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white font-medium px-4 py-2.5 rounded-lg shadow-sm transition-all"
          >
            {savingEdit ? "Saving..." : "Save"}
          </button>
          <button
            onClick={() => setEditUser(null)}
            className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium px-4 py-2.5 rounded-lg transition-all"
          >
            Cancel
          </button>
        </div>
      </Modal>
    </>
  );
}