import React from 'react';
import ReportGenerator from '../components/ReportGenerator';

const Reports: React.FC = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-8">
        レポート生成
      </h1>
      <ReportGenerator />
    </div>
  );
};

export default Reports;