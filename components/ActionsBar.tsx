import React from 'react';

interface ActionsBarProps {
    onAddMeasurement: () => void;
    onAddNewOption: () => void;
    onGeneratePdf: () => void;
    onOpenAIModal: () => void;
    isGeneratingPdf: boolean;
}

const ActionsBar: React.FC<ActionsBarProps> = ({
    onAddMeasurement,
    onAddNewOption,
    onGeneratePdf,
    onOpenAIModal,
    isGeneratingPdf
}) => {
    const baseButton = "w-full p-4 rounded-lg transition duration-300 shadow-md font-semibold text-sm flex items-center justify-center";
    
    return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button onClick={onAddMeasurement} className={`${baseButton} bg-slate-800 text-white hover:bg-slate-700`}>
                Adicionar Medida
            </button>
            <button onClick={onOpenAIModal} className={`${baseButton} bg-slate-700 text-white hover:bg-slate-600 flex items-center gap-2`}>
                <i className="fas fa-robot"></i> Preencher com IA
            </button>
            <button onClick={onAddNewOption} className={`${baseButton} bg-slate-200 text-slate-700 hover:bg-slate-300`}>
                Nova Opção
            </button>
            <button 
                onClick={onGeneratePdf} 
                className={`${baseButton} bg-slate-800 text-white hover:bg-slate-900 disabled:bg-slate-500 disabled:cursor-wait`}
                disabled={isGeneratingPdf}
            >
                {isGeneratingPdf ? <span className="loader-sm"></span> : 'Gerar PDF'}
            </button>
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
};

export default React.memo(ActionsBar);