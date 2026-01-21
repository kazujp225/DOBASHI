import React from 'react';
import ReportGenerator from '../components/ReportGenerator';

const Reports: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">レポート生成</h1>
        <p className="text-muted-foreground">分析データをCSV形式でエクスポート</p>
      </div>
      <ReportGenerator />
    </div>
  );
};

export default Reports;
