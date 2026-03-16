export const StockManagementHeaderSection = (): JSX.Element => {
  return (
    <header className="w-full h-[92px] bg-[#0f0f0f] border border-solid border-[#ffffff80] flex items-center justify-between px-6">
      {/* Logo on the left */}
      <div className="[font-family:'Inter',Helvetica] font-bold text-[#ffff00] text-[40px] tracking-[0] leading-[normal] whitespace-nowrap">
        LOGO
      </div>

      {/* Title in the center */}
      <div className="[font-family:'Inter',Helvetica] font-bold text-white text-[32px] tracking-[0] leading-[normal]">
        STOCK MANAGEMENT
      </div>

      {/* User greeting and avatar on the right */}
      <div className="flex items-center gap-1.5">
        <span className="[font-family:'Inter',Helvetica] font-bold text-[#ffff00] text-xl tracking-[0] leading-[normal]">
          Hello, Yossapon
        </span>
        <img
          className="w-[60px] h-[61px]"
          alt="Icon"
          src="/figmaAssets/icon.svg"
        />
      </div>
    </header>
  );
};
