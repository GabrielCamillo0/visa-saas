export function PdfDownload({ submissionId }: { submissionId: string }){
    return (
    <a className="px-3 py-2 rounded bg-black text-white inline-block" href={`/dashboard/submissions/${submissionId}/pdf`} target="_blank">Baixar PDF</a>
    );
    }