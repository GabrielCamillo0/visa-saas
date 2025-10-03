export function SubmissionCard({ item }: { item: { id: string; status: string; created_at?: string } }){
    return (
    <li className="p-3 rounded border bg-white">
    <a className="underline" href={`/dashboard/submissions/${item.id}`}>#{item.id}</a>
    <span className="ml-3 text-gray-600 text-sm">{item.status}</span>
    {item.created_at && <span className="ml-3 text-gray-500 text-xs">{new Date(item.created_at).toLocaleString()}</span>}
    </li>
    );
    }