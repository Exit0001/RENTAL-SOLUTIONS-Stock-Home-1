export const StockManagementHeaderSection = (): JSX.Element => {
  return (
    <header className="w-full h-16 bg-[#0f0f0f] border-b border-white/10 flex items-center justify-between px-6 flex-shrink-0">
      <div className="font-bold text-yellow-400 text-2xl tracking-widest">
        LOGO
      </div>

      <div className="font-bold text-white text-lg tracking-widest uppercase">
        Stock Management
      </div>

      <div className="flex items-center gap-3">
        <span className="font-semibold text-yellow-400 text-sm">
          Hello, Yossapon
        </span>
        <img
          className="w-9 h-9 rounded-full object-cover"
          alt="User avatar"
          src="/figmaAssets/icon.svg"
        />
      </div>
    </header>
  );
};
