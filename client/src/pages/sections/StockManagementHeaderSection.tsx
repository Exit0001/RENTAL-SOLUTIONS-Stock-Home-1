export const StockManagementHeaderSection = (): JSX.Element => {
  return (
    <header className="w-full h-16 bg-[#0f0f0f] border-b border-white/10 flex items-center justify-between px-6 flex-shrink-0 animate-fade-in">
      <div className="font-bold text-[#FFFF00] text-2xl tracking-widest animate-fade-in" style={{ animationDelay: "0ms" }}>
        LOGO
      </div>

      <div className="font-bold text-white text-lg tracking-widest uppercase animate-fade-in" style={{ animationDelay: "100ms" }}>
        Stock Management
      </div>

      <div className="flex items-center gap-3 animate-fade-in" style={{ animationDelay: "200ms" }}>
        <span className="font-semibold text-[#FFFF00] text-sm">
          Hello, Yossapon
        </span>
        <img
          className="w-9 h-9 rounded-full object-cover transition-transform duration-200 hover:scale-110"
          alt="User avatar"
          src="/figmaAssets/icon.svg"
        />
      </div>
    </header>
  );
};
