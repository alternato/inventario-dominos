export const KpiCard = ({ title, value, color, sub, onClick }) => {
  const styles = {
    blue:   { b: 'border-[#0066CC]', t: 'text-[#0066CC]', txt: 'text-gray-500' },
    green:  { b: 'border-[#10B981]', t: 'text-[#10B981]', txt: 'text-green-600' },
    yellow: { b: 'border-[#F59E0B]', t: 'text-[#F59E0B]', txt: 'text-yellow-600' },
    red:    { b: 'border-[#E31837]', t: 'text-[#E31837]', txt: 'text-red-600' },
  };
  const s = styles[color] || styles.blue;
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl shadow-sm border border-gray-100 p-5 pl-6 border-l-[6px] ${s.b} hover:shadow-md transition relative overflow-hidden flex flex-col justify-between min-h-[140px] ${onClick ? 'cursor-pointer hover:bg-gray-50 transform hover:-translate-y-1' : ''}`}
    >
      <div>
        <p className="text-[10px] font-bold text-gray-400 tracking-wider uppercase mb-1">{title}</p>
        <p className={`text-4xl font-extrabold ${s.t}`}>{value}</p>
      </div>
      {sub && <p className={`text-sm font-semibold mt-4 ${s.txt}`}>{sub} ☝️</p>}
    </div>
  );
};
