import React from 'react';
import ComparisonDashboard from '../components/ComparisonDashboard';

const Comparison: React.FC = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-8">
        比較分析
      </h1>
      <ComparisonDashboard />
    </div>
  );
};

export default Comparison;