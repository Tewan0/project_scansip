import { redirect } from "next/navigation";
import { AccessError, getAccessForUser, requireUser } from "@/lib/auth";
import { homeForRole } from "@/lib/permissions";
import { listStaffInvitations } from "@/lib/staff-invitations";
import { StaffInvitations } from "@/components/staff-invitations";

export default async function WorkspacePage() {
  let user, access;
  try {
    user = await requireUser();
    access = await getAccessForUser(user);
  } catch (error) {
    if (error instanceof AccessError) redirect(error.status === 401 ? "/owner/login" : "/access-denied");
    throw error;
  }
  if (access) redirect(homeForRole(access.role));
  const invitations = await listStaffInvitations(user);
  return <StaffInvitations email={user.email ?? ""} invitations={invitations} />;
}
