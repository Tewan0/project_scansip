"use client";

import { useState } from "react";

interface StaffMember {
  id: string;
  name: string;
  email: string;
  status: "Active" | "Pending";
  initials: string;
}

const initialStaff: StaffMember[] = [
  {
    id: "1",
    name: "Jane Doe",
    email: "jane.doe@scansip.com",
    status: "Active",
    initials: "JD",
  },
  {
    id: "2",
    name: "Mike Smith",
    email: "mike.smith@scansip.com",
    status: "Active",
    initials: "MS",
  },
  {
    id: "3",
    name: "Alex Johnson",
    email: "alex.j@scansip.com",
    status: "Pending",
    initials: "AJ",
  },
];

export default function ManageStaffPage() {
  const [staffList, setStaffList] = useState<StaffMember[]>(initialStaff);
  const [emailInput, setEmailInput] = useState("");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleAddStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput) return;

    // Derive name and initials from email
    const username = emailInput.split("@")[0].replace(/[._]/g, " ");
    const formattedName = username
      .split(" ")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");

    const initials = username
      .split(" ")
      .map((part) => part.charAt(0).toUpperCase())
      .slice(0, 2)
      .join("");

    const newStaff: StaffMember = {
      id: Date.now().toString(),
      name: formattedName || "Staff Member",
      email: emailInput,
      status: "Pending",
      initials: initials || "ST",
    };

    setStaffList((prev) => [newStaff, ...prev]);
    setEmailInput("");
    setSuccessMessage(`Invitation sent to ${emailInput}`);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleRemoveStaff = (id: string) => {
    setStaffList((prev) => prev.filter((staff) => staff.id !== id));
  };

  return (
    <div className="p-stack-md md:p-margin-page">
      <div className="max-w-4xl mx-auto space-y-stack-lg">
        {/* Success Alert Banner */}
        {successMessage && (
          <div className="p-stack-sm rounded-lg bg-status-success/10 border border-status-success/30 text-status-success flex items-center gap-2 text-xs animate-fadeIn">
            <span className="material-symbols-outlined text-sm">check_circle</span>
            <span>{successMessage}</span>
          </div>
        )}

        {/* Add Staff Section */}
        <section className="bg-surface-card rounded-xl border border-border-subtle p-gutter shadow-xs">
          <div className="flex items-center gap-2 mb-stack-sm">
            <span className="material-symbols-outlined text-primary text-[22px]">
              person_add
            </span>
            <h3 className="font-headline-md text-headline-md font-bold text-primary">
              Add New Staff Member
            </h3>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant mb-stack-md">
            Only added emails can sign in to the Staff dashboard via Google.
          </p>
          <form
            onSubmit={handleAddStaff}
            className="flex flex-col sm:flex-row gap-stack-md items-start sm:items-center"
          >
            <div className="flex-1 w-full relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">
                mail
              </span>
              <input
                className="w-full h-9 pl-10 pr-3 rounded-lg border border-border-subtle bg-surface focus:border-secondary focus:ring-2 focus:ring-secondary/20 focus:outline-none transition-all font-body-sm text-body-sm text-on-surface placeholder:text-on-surface-variant"
                placeholder="staff@example.com"
                required
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
              />
            </div>
            <button
              className="h-9 px-6 bg-primary text-on-primary rounded-lg font-label-md text-label-md hover:bg-primary/90 transition-colors whitespace-nowrap flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              type="submit"
            >
              <span className="material-symbols-outlined text-[18px]">person_add</span>
              Add Staff
            </button>
          </form>
        </section>

        {/* Staff List Section */}
        <section className="bg-surface-card rounded-xl border border-border-subtle overflow-hidden shadow-xs">
          <div className="px-gutter py-stack-md border-b border-border-subtle bg-surface/50 flex justify-between items-center">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-on-surface-variant text-[18px]">
                groups
              </span>
              <h3 className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider font-semibold">
                Active Staff ({staffList.length})
              </h3>
            </div>
          </div>
          <div className="divide-y divide-border-subtle">
            {staffList.length === 0 ? (
              <div className="p-gutter text-center text-on-surface-variant text-body-sm">
                No staff members added yet. Add an email above to grant access.
              </div>
            ) : (
              staffList.map((staff) => (
                <div
                  key={staff.id}
                  className="flex items-center justify-between p-gutter hover:bg-surface-container-lowest transition-colors group"
                >
                  <div className="flex items-center gap-stack-md">
                    <div className="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center text-primary font-bold text-sm shrink-0">
                      {staff.initials}
                    </div>
                    <div>
                      <p className="font-body-md text-body-md text-on-surface font-semibold">
                        {staff.name}
                      </p>
                      <p className="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1">
                        <span className="material-symbols-outlined text-[13px]">mail</span>
                        {staff.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-stack-md">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded font-label-md text-[10px] uppercase font-bold tracking-wider ${
                        staff.status === "Active"
                          ? "bg-status-success/10 text-status-success"
                          : "bg-status-warning/10 text-status-warning"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[12px]">
                        {staff.status === "Active" ? "check_circle" : "schedule"}
                      </span>
                      {staff.status}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveStaff(staff.id)}
                      aria-label="Remove staff"
                      title="Remove staff member"
                      className="text-on-surface-variant hover:text-error transition-colors p-2 rounded-lg hover:bg-error-container/30 opacity-80 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[20px]">delete</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
