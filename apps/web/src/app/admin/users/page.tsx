"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminFrame } from "@/components/admin-frame";
import { Button, Card, Loading, Notice, fmtDate } from "@/components/ui";
import { errorText, useApi, useMe } from "@/lib/api";

interface Row {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  createdAt: string;
  projects: number;
  orders: number;
}

export default function Page() {
  return (
    <AdminFrame tab="users">
      <Users />
    </AdminFrame>
  );
}

function Users() {
  const api = useApi();
  const qc = useQueryClient();
  const { data: me } = useMe();
  const q = useQuery({ queryKey: ["admin", "users"], queryFn: () => api<Row[]>("/admin/users") });
  const role = useMutation({ mutationFn: (u: Row) => api(`/admin/users/${u.id}`, { method: "PATCH", body: { role: u.role === "admin" ? "user" : "admin" } }), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }) });
  if (q.isLoading) return <Loading />;
  if (q.isError) return <Notice>{q.error.message}</Notice>;
  return (
    <>
      {role.isError && <Notice className="mb-4">{errorText(role.error)}</Notice>}
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-[14px]">
          <thead>
            <tr className="border-b border-line text-left text-[12.5px] text-ink-3">
              <th className="px-5 py-3 font-medium">User</th>
              <th className="px-3 py-3 font-medium">Joined</th>
              <th className="px-3 py-3 text-right font-medium">Projects</th>
              <th className="px-3 py-3 text-right font-medium">Orders</th>
              <th className="px-5 py-3 text-right font-medium">Role</th>
            </tr>
          </thead>
          <tbody>
            {q.data!.map((u) => (
              <tr key={u.id} className="border-b border-line last:border-0">
                <td className="px-5 py-3">
                  <span className="font-semibold">{u.name || "(no name)"}</span>
                  <span className="block text-[12.5px] text-ink-3">{u.email}</span>
                </td>
                <td className="px-3 text-ink-2">{fmtDate(u.createdAt)}</td>
                <td className="px-3 text-right tabular-nums">{u.projects}</td>
                <td className="px-3 text-right tabular-nums">{u.orders}</td>
                <td className="px-5 text-right">
                  <span className={`mr-3 rounded-full px-2.5 py-1 text-[12.5px] font-medium ${u.role === "admin" ? "bg-leaf-soft text-leaf-dark" : "bg-sand text-ink-2"}`}>{u.role}</span>
                  <Button size="sm" disabled={role.isPending || u.id === me?.id} title={u.id === me?.id ? "You can't change your own role" : undefined} onClick={() => confirm(`${u.role === "admin" ? "Remove admin access from" : "Make an admin of"} ${u.email}?`) && role.mutate(u)}>
                    {u.role === "admin" ? "Remove admin" : "Make admin"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
