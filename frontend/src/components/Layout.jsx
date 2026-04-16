import { Navbar } from './Navbar';

export const Layout = ({ children, onLogout }) => {
  return (
    <div className="flex flex-col h-screen bg-[#f4f6f8] overflow-hidden">
      <Navbar onLogout={onLogout} />
      {/* Scrollable container that spans full viewport width */}
      <div className="flex-1 overflow-y-auto w-full">
        <main className="w-full max-w-[1600px] 2xl:max-w-[2100px] mx-auto px-4 md:px-6 2xl:px-12 py-6 flex flex-col min-h-full">
          {children}
        </main>
      </div>
    </div>
  );
};
