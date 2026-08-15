"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth, isAdminOrAbove, isSuperuser, type Role } from "@/lib/AuthContext";
import Header from "@/components/Header";
import Modal from "@/components/Modal";

interface DbUser {
  id: number;
  username: string;
  role: Role;
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
  const [newRole, setNewRole] = useState<Role>("view-only");
  const [adding, setAdding] = useState(false);

  // Edit user modal
  const [editUser, setEditUser] = useState<DbUser | null>(null);
  const [editUsername, setEditUsername] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editRole, setEditRole] = useState<Role>("view-only");
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    if (!authenticated) {
      router.push("/authenticate");
    }
  }, [authenticated, router]);

  useEffect(() => {
    if (authenticated && !isAdminOrAbove(currentUser)) {
      router.push("/");
    }
  }, [authenticated, currentUser, router]);

  const fetchUsers = async () => {
    setLoading(true);
    // Never select the password column, and keep superusers out of the
    // payload entirely when the viewer is an admin (not just hidden in the UI).
    let query = supabase.from("users").select("id, username, role, created_at");
    if (!isSuperuser(currentUser)) {
      query = query.neq("role", "superuser");
    }
    const { data } = await query.order("username", { ascending: true });
    setUsers(data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (authenticated && isAdminOrAbove(currentUser)) {
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
    // Prevent a superuser from changing their own role (self-demotion)
    if (editUser.id === currentUser?.id && editRole !== editUser.role) {
      alert("You cannot change your own role.");
      return;
    }
    // Prevent demoting the last superuser in the system
    if (
      editUser.role === "superuser" &&
      editRole !== "superuser" &&
      users.filter((u) => u.role === "superuser" && u.id !== editUser.id).length === 0
    ) {
      alert("At least one superuser must remain in the system.");
      return;
    }
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
    // Prevent deleting the last superuser
    if (targetUser.role === "superuser") {
      const superuserCount = users.filter(
        (u) => u.role === "superuser" && u.id !== targetUser.id
      ).length;
      if (superuserCount === 0) {
        alert("At least one superuser must remain in the system.");
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
  if (!isAdminOrAbove(currentUser)) return null;

  // Admins see every user except superusers; superusers see everyone.
  const visibleUsers = isSuperuser(currentUser)
    ? users
    : users.filter((u) => u.role !== "superuser");

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
      <div className="page-shell">
        <div className="max-w-3xl mx-auto flex flex-col gap-4 sm:gap-6">
          <div>
            <h1 className="page-title">User Management</h1>
            <p className="page-subtitle mt-0.5">
              {isSuperuser(currentUser)
                ? "Add, edit, or delete users"
                : "View all users (read-only)"}
            </p>
          </div>

          {/* Read-only notice for admins */}
          {!isSuperuser(currentUser) && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
              You have <span className="font-semibold">read-only</span> access. Only superusers can
              add, edit, or delete users.
            </div>
          )}

          {/* Add User Form (superusers only) */}
          {isSuperuser(currentUser) && (
          <div className="card-solid p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Add New User</h2>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
              <div className="flex-1">
                <label htmlFor="new-username" className="block text-xs font-medium text-slate-600 mb-1">
                  Username
                </label>
                <input
                  id="new-username"
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="Username"
                  className="w-full bg-slate-50 border border-slate-200/70 rounded-xl px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-accent focus:bg-white"
                />
              </div>
              <div className="flex-1">
                <label htmlFor="new-password" className="block text-xs font-medium text-slate-600 mb-1">
                  Password
                </label>
                <input
                  id="new-password"
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full bg-slate-50 border border-slate-200/70 rounded-xl px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-accent focus:bg-white"
                />
              </div>
              <div className="w-full sm:w-32">
                <label htmlFor="new-role" className="block text-xs font-medium text-slate-600 mb-1">
                  Role
                </label>
                <select
                  id="new-role"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as Role)}
                  className="w-full bg-slate-50 border border-slate-200/70 rounded-xl px-3 py-2 text-sm text-slate-900 focus:border-accent focus:bg-white"
                >
                  <option value="superuser">Superuser</option>
                  <option value="admin">Admin</option>
                  <option value="view-only">View-only</option>
                </select>
              </div>
              <button
                onClick={handleAddUser}
                disabled={adding || !newUsername.trim() || !newPassword.trim()}
                className="bg-accent hover:bg-accent-hover disabled:bg-accent/40 text-white font-medium px-5 py-2 rounded-lg text-sm shadow-sm transition-all whitespace-nowrap"
              >
                {adding ? "Adding..." : "Add User"}
              </button>
            </div>
          </div>
          )}

          {/* Users Table */}
          <div className="card-solid overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-slate-400 text-sm animate-pulse">Loading users...</div>
            ) : visibleUsers.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-4xl mb-3">👤</div>
                <h2 className="text-lg font-semibold text-slate-900 mb-1">No users yet</h2>
                <p className="text-sm text-slate-500">
                  {isSuperuser(currentUser)
                    ? "Add the first user above."
                    : "No users to display."}
                </p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-slate-100">
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Username</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Role</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600 hidden sm:table-cell">Created</th>
                    {isSuperuser(currentUser) && (
                      <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {visibleUsers.map((u) => (
                    <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {u.username}
                        {u.id === currentUser?.id && (
                          <span className="ml-2 text-[10px] bg-accent/15 text-accent font-semibold px-1.5 py-0.5 rounded-full">You</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                          u.role === "superuser"
                            ? "bg-purple-100 text-purple-800"
                            : u.role === "admin"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-gray-100 text-slate-600"
                        }`}>
                          {u.role === "superuser"
                            ? "Superuser"
                            : u.role === "admin"
                            ? "Admin"
                            : "View-only"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">{formatDate(u.created_at)}</td>
                      {isSuperuser(currentUser) && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openEditModal(u)}
                              className="text-xs font-medium text-accent hover:text-accent-hover transition-colors"
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
                      )}
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
            <label htmlFor="edit-username" className="block text-sm font-medium text-slate-700 mb-1">
              Username
            </label>
            <input
              id="edit-username"
              type="text"
              value={editUsername}
              onChange={(e) => setEditUsername(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200/70 rounded-xl px-3 py-2.5 text-slate-900 focus:border-accent focus:bg-white"
            />
          </div>
          <div>
            <label htmlFor="edit-password" className="block text-sm font-medium text-slate-700 mb-1">
              New password <span className="text-slate-400 font-normal">(leave blank to keep current)</span>
            </label>
            <input
              id="edit-password"
              type="text"
              value={editPassword}
              onChange={(e) => setEditPassword(e.target.value)}
              placeholder="Leave blank to keep current"
              className="w-full bg-slate-50 border border-slate-200/70 rounded-xl px-3 py-2.5 text-slate-900 placeholder-slate-400 focus:border-accent focus:bg-white"
            />
          </div>
          <div>
            <label htmlFor="edit-role" className="block text-sm font-medium text-slate-700 mb-1">
              Role
            </label>
            <select
              id="edit-role"
              value={editRole}
              onChange={(e) => setEditRole(e.target.value as Role)}
              className="w-full bg-slate-50 border border-slate-200/70 rounded-xl px-3 py-2.5 text-slate-900 focus:border-accent focus:bg-white"
            >
              <option value="superuser">Superuser</option>
              <option value="admin">Admin</option>
              <option value="view-only">View-only</option>
            </select>
          </div>
        </div>
        <div className="flex w-full gap-2 mt-5 pt-4 border-t border-slate-100">
          <button
            onClick={handleSaveEdit}
            disabled={savingEdit || !editUsername.trim()}
            className="btn-primary flex-1 px-4 py-2.5"
          >
            {savingEdit ? "Saving..." : "Save"}
          </button>
          <button
            onClick={() => setEditUser(null)}
            className="btn-secondary flex-1 px-4 py-2.5"
          >
            Cancel
          </button>
        </div>
      </Modal>
    </>
  );
}