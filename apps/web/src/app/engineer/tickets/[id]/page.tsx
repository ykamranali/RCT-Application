import { redirect } from 'next/navigation';

/**
 * Engineers use the same ticket detail screen as the rest of the team.
 * Keeping one implementation means the workflow, the timeline and the
 * signature capture can never drift between the two entry points.
 */
export default async function EngineerTicketRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/tickets/${id}`);
}
