import { Navbar } from './Navbar';

export const Layout = ({ children, onLogout }) => {
  return (
    <div className="flex flex-col h-screen bg-[#f4f6f8]">
      <Navbar onLogout={onLogout} />
      <main className="flex-1 overflow-hidden w-full max-w-[1600px] 2xl:max-w-[2000px] mx-auto px-4 md:px-6 2xl:px-12 py-6 border-t-[8px] border-[#f4f6f8] flex flex-col" style={{marginTop: '-2px'}}>
        {children}
      </main>
    </div>
  );
};
