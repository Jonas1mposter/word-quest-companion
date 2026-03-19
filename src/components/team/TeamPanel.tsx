export const TeamPanel = ({ onBack }: { onBack: () => void }) => (
  <div className="min-h-screen bg-background flex items-center justify-center p-6">
    <div className="text-center">
      <h2 className="text-xl font-bold mb-4">战队系统</h2>
      <p className="text-muted-foreground mb-6">战队系统需要在线服务，本地模式暂不可用</p>
      <button onClick={onBack} className="text-primary underline">返回</button>
    </div>
  </div>
);
