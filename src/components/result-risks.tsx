export function ResultRisks({ items }: { items?: string[] }){
    if (!items?.length) return null;
    return (
    <div>
    <h4 className="font-medium">Riscos e observações</h4>
    <ul className="list-disc ml-6">
    {items.map((d,i)=> <li key={i}>{d}</li>)}
    </ul>
    </div>
    );
    }