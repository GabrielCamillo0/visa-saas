export function ResultActionPlan({ steps }: { steps: string[] }){
    if (!steps?.length) return null;
    return (
    <div>
    <h4 className="font-medium">Passos</h4>
    <ol className="list-decimal ml-6">
    {steps.map((s,i)=> <li key={i}>{s}</li>)}
    </ol>
    </div>
    );
    }