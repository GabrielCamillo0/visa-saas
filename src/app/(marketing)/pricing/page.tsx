export default function Pricing(){
    return (
    <div className="mx-auto max-w-3xl p-8">
    <h1 className="text-3xl font-bold mb-4">Planos</h1>
    <ul className="space-y-4">
    <li className="border rounded p-4 bg-white">
    <h2 className="text-xl font-semibold">Basic</h2>
    <p className="text-gray-600">X submissões/mês</p>
    </li>
    <li className="border rounded p-4 bg-white">
    <h2 className="text-xl font-semibold">Pro</h2>
    <p className="text-gray-600">Submissões ilimitadas</p>
    </li>
    </ul>
    </div>
    );
    }