

import React, { useState } from 'react';

interface Totals {
    totalM2: number;
    subtotal: number;
    totalItemDiscount: number;
    generalDiscountAmount: number;
    finalTotal: number;
}

interface MobileFooterProps {
    totals: Totals;
    generalDiscount: { value: string; type: 'percentage' | 'fixed' };
    onGeneralDiscountChange: (discount: { value: string; type: 'percentage' | 'fixed' }) => void;
    onAddMeasurement: () => void;
    onAddNewOption: () => void;
    onGeneratePdf: () => void;
    onOpenAIModal: () => void;
    isGeneratingPdf: boolean;
}

const formatNumberBR = (number: number) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(number);
};

const MobileFooter: React.FC<MobileFooterProps> = ({
    totals,
    generalDiscount,
    onGeneralDiscountChange,
    onAddMeasurement,
    onAddNewOption,
    onGeneratePdf,
    onOpenAIModal,
    isGeneratingPdf
}) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const handleDiscountValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { value } = e.target;
        const isValidFormat = /^[0-9]*[.,]?[0-9]*$/.test(value);
        if (isValidFormat) {
            onGeneralDiscountChange({ ...generalDiscount, value });
        }
    };
    
    const handleDiscountTypeChange = (type: 'percentage' | 'fixed') => {
        onGeneralDiscountChange({ ...generalDiscount, type });
    };

    const SummaryRow: React.FC<{label: string; value: string, className?: string}> = ({label, value, className}) => (
        <div className={`flex justify-between items-center text-sm ${className}`}>
            <span className="text-slate-600">{label}</span>
            <span className="font-semibold text-slate-800">{value}</span>
        </div>
    );

    const DiscountControls = () => (
        <div className="mt-4 pt-4 border-t border-slate-200">
            <label className="block text-sm font-medium text-slate-600">Desconto Geral</label>
            <div className="mt-1 flex">
                <input
                    type="text"
                    value={generalDiscount.value}
                    onChange={handleDiscountValueChange}
                    className="w-full p-2 bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-l-md shadow-sm focus:ring-slate-500 focus:border-slate-500 sm:text-sm"
                    placeholder="0"
                    inputMode="decimal"
                />
                <div className="flex">
                    <button type="button" onClick={() => handleDiscountTypeChange('percentage')} className={`px-4 py-2 text-sm font-semibold border-t border-b ${generalDiscount.type === 'percentage' ? 'bg-slate-800 text-white border-slate-800 z-10' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}>
                        %
                    </button>
                    <button type="button" onClick={() => handleDiscountTypeChange('fixed')} className={`px-4 py-2 text-sm font-semibold border rounded-r-md ${generalDiscount.type === 'fixed' ? 'bg-slate-800 text-white border-slate-800 z-10' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}>
                        R$
                    </button>
                </div>
            </div>
        </div>
    );
    
    const ActionButton: React.FC<{onClick: () => void, label: string, icon: string, isActive?: boolean}> = ({ onClick, label, icon, isActive = false }) => (
        <button onClick={onClick} aria-label={label} className={`flex flex-col items-center justify-center transition-colors w-16 h-full ${isActive ? 'text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}>
            <i className={`${icon} text-xl h-6`}></i>
            <span className="text-[10px] mt-1 font-medium">{label}</span>
        </button>
    );

    const PdfActionButton = () => {
        if (isGeneratingPdf) {
            return (
                <div className="flex flex-col items-center justify-center w-16 h-full text-slate-500">
                     <div className="loader-sm"></div>
                     <span className="text-[10px] mt-1 font-medium">Gerando...</span>
                     <style jsx>{`
                        .loader-sm {
                            border: 3px solid #f3f3f3;
                            border-top: 3px solid #3498db;
                            border-radius: 50%;
                            width: 20px;
                            height: 20px;
                            animation: spin 1s linear infinite;
                        }
                        @keyframes spin {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(360deg); }
                        }
                     `}</style>
                </div>
            );
        }
        return <ActionButton onClick={onGeneratePdf} label="Gerar PDF" icon="fas fa-file-pdf" />;
    };


    return (
        <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-sm shadow-[0_-8px_20px_rgba(0,0,0,0.1)] border-t border-slate-200 z-30">
            <div className="container mx-auto px-2">
                {/* Expandable Content */}
                <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isExpanded ? 'max-h-80 opacity-100 p-4 border-b border-slate-200/80' : 'max-h-0 opacity-0 p-0'}`}>
                    <div className="space-y-1.5">
                        <SummaryRow label={`Subtotal (${totals.totalM2.toFixed(2)} m²)`} value={formatNumberBR(totals.subtotal)} />
                        {totals.totalItemDiscount > 0 && <SummaryRow label="Descontos (itens)" value={`-${formatNumberBR(totals.totalItemDiscount)}`} />}
                        {totals.generalDiscountAmount > 0 && <SummaryRow label="Desconto Geral" value={`-${formatNumberBR(totals.generalDiscountAmount)}`} />}
                         <div className="pt-1.5 mt-1.5 border-t border-slate-200">
                            <SummaryRow label="Total" value={formatNumberBR(totals.finalTotal)} className='text-base' />
                        </div>
                    </div>
                    <DiscountControls />
                </div>
                
                {/* Main Action Bar */}
                <div className="relative">
                    <div className="flex justify-around items-center h-16">
                        <ActionButton onClick={onOpenAIModal} label="com IA" icon="fas fa-robot" />
                        <ActionButton onClick={onAddNewOption} label="Nova Opção" icon="fas fa-copy" />

                        {/* Floating Action Button */}
                        <div className="-translate-y-6">
                            <button
                                onClick={onAddMeasurement}
                                aria-label="Adicionar Nova Medida"
                                className="w-16 h-16 bg-slate-900 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500"
                            >
                                <i className="fas fa-plus text-2xl"></i>
                            </button>
                        </div>

                        <ActionButton 
                            onClick={() => setIsExpanded(!isExpanded)} 
                            label="Totais" 
                            icon="fas fa-chevron-up"
                            isActive={isExpanded}
                        />
                        <PdfActionButton />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default React.memo(MobileFooter);