import React, { useState, useEffect, FormEvent } from 'react';
import { UserInfo } from '../../types';
import Input from '../ui/Input';
import ColorPicker from '../ui/ColorPicker';
import SignatureModal from '../modals/SignatureModal';

interface UserSettingsViewProps {
    userInfo: UserInfo;
    onSave: (userInfo: UserInfo) => void;
    onOpenPaymentMethods: () => void;
}

const applyPhoneMask = (value: string) => {
    if (!value) return "";
  
    let digitsOnly = value.replace(/\D/g, "");
  
    if (digitsOnly.length > 11) {
      digitsOnly = digitsOnly.slice(0, 11);
    }
  
    if (digitsOnly.length > 10) {
      return `(${digitsOnly.slice(0, 2)}) ${digitsOnly.slice(2, 7)}-${digitsOnly.slice(7)}`;
    }
    if (digitsOnly.length > 6) {
      return `(${digitsOnly.slice(0, 2)}) ${digitsOnly.slice(2, 6)}-${digitsOnly.slice(6)}`;
    }
    if (digitsOnly.length > 2) {
      return `(${digitsOnly.slice(0, 2)}) ${digitsOnly.slice(2)}`;
    }
    if (digitsOnly.length > 0) {
      return `(${digitsOnly}`;
    }
    return "";
};

const UserSettingsView: React.FC<UserSettingsViewProps> = ({ userInfo, onSave, onOpenPaymentMethods }) => {
    const [formData, setFormData] = useState<UserInfo>(userInfo);
    const [logoPreview, setLogoPreview] = useState<string | undefined>(userInfo.logo);
    const [isSaving, setIsSaving] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [newEmployeeName, setNewEmployeeName] = useState('');
    const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);


    useEffect(() => {
        setFormData(userInfo);
        setLogoPreview(userInfo.logo);
    }, [userInfo]);
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { id, value } = e.target;
        if (id === 'telefone') {
            setFormData(prev => ({ ...prev, [id]: applyPhoneMask(value) }));
        } else if (id === 'aiProvider') {
             setFormData(prev => ({ ...prev, aiConfig: { ...prev.aiConfig!, provider: value as 'none' | 'gemini' | 'openai' } }));
        } else if (id === 'aiApiKey') {
            setFormData(prev => ({ ...prev, aiConfig: { ...prev.aiConfig!, apiKey: value } }));
        } else if (id === 'proposalValidityDays') {
            const numValue = parseInt(value, 10);
            setFormData(prev => ({ ...prev, [id]: isNaN(numValue) || numValue < 1 ? undefined : numValue }));
        } else {
            setFormData(prev => ({ ...prev, [id]: value }));
        }
    };
    
    const handleColorChange = (colorType: 'primaria' | 'secundaria', value: string) => {
        setFormData(prev => ({
            ...prev,
            cores: {
                ...(prev.cores || { primaria: '#918B45', secundaria: '#4E6441' }),
                [colorType]: value
            }
        }));
    };
    
    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result as string;
                setFormData(prev => ({ ...prev, logo: base64String }));
                setLogoPreview(base64String);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleRemoveLogo = () => {
        setFormData(prev => ({ ...prev, logo: '' }));
        setLogoPreview('');
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        await (onSave(formData) || Promise.resolve());
        setIsSaving(false);
        setShowSuccess(true);
        setTimeout(() => {
            setShowSuccess(false);
        }, 3000);
    };

    const handleWorkingDayChange = (dayIndex: number, checked: boolean) => {
        setFormData(prev => {
            const currentDays = prev.workingHours?.days || [];
            const newDays = checked
                ? [...currentDays, dayIndex]
                : currentDays.filter(d => d !== dayIndex);
            newDays.sort((a, b) => a - b);
            return {
                ...prev,
                workingHours: {
                    ...(prev.workingHours || { start: '08:00', end: '18:00', days: [] }),
                    days: newDays,
                }
            };
        });
    };

    const handleWorkingTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target;
        const field = id.split('-')[1] as 'start' | 'end';

        setFormData(prev => ({
            ...prev,
            workingHours: {
                ...(prev.workingHours || { start: '08:00', end: '18:00', days: [1, 2, 3, 4, 5] }),
                [field]: value,
            }
        }));
    };
    
    const handleAddEmployee = () => {
        if (newEmployeeName.trim()) {
            setFormData(prev => ({
                ...prev,
                employees: [
                    ...(prev.employees || []),
                    { id: Date.now(), nome: newEmployeeName.trim() }
                ]
            }));
            setNewEmployeeName('');
        }
    };

    const handleRemoveEmployee = (id: number) => {
        setFormData(prev => ({
            ...prev,
            employees: (prev.employees || []).filter(emp => emp.id !== id)
        }));
    };
    
    const handleSaveSignature = (signatureDataUrl: string) => {
        setFormData(prev => ({ ...prev, assinatura: signatureDataUrl }));
        setIsSignatureModalOpen(false);
    };

    const labelClass = "block text-sm font-medium text-slate-700 mb-1";
    const sectionTitleClass = "text-lg font-semibold text-slate-800";
    const sectionClass = "pt-6 mt-6 border-t border-slate-200";

    return (
        <form id="userForm" onSubmit={handleSubmit} className="space-y-6 p-1">
            <div className="space-y-4">
                <Input id="cpfCnpj" label="CPF/CNPJ" placeholder="Seu CPF ou CNPJ" type="text" value={formData.cpfCnpj} onChange={handleChange} required />
                <Input id="site" label="Site" type="text" value={formData.site || ''} onChange={handleChange} placeholder="www.peliculasbrasil.com.br" />
            </div>

            <div className={sectionClass}>
                 <h3 className={sectionTitleClass}>Dados da Empresa</h3>
                 <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input id="empresa" label="Nome da Empresa" type="text" value={formData.empresa} onChange={handleChange} required />
                    <Input id="nome" label="Seu Nome" type="text" value={formData.nome} onChange={handleChange} required />
                    <Input id="telefone" label="Telefone" type="tel" value={formData.telefone} onChange={handleChange} required placeholder="(XX) XXXXX-XXXX" maxLength={15} />
                    <Input id="email" label="Email" type="email" value={formData.email} onChange={handleChange} required />
                 </div>
                 <div className="mt-4">
                     <Input id="endereco" label="Endereço" type="text" value={formData.endereco} onChange={handleChange} required />
                 </div>
            </div>

            <div className={sectionClass}>
                <h3 className={sectionTitleClass}>Personalização do Orçamento</h3>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-5 gap-6 items-start">
                    <div className="md:col-span-3">
                        <label className={labelClass}>Logotipo</label>
                        <div className="mt-1 flex flex-col justify-center items-center p-6 border-2 border-slate-300 border-dashed rounded-lg h-full min-h-[200px]">
                            {logoPreview ? (
                                <>
                                    <img src={logoPreview} alt="Preview do logotipo" className="mx-auto max-h-24 w-auto rounded" />
                                    <div className="flex text-sm justify-center gap-4 pt-4 mt-2">
                                        <label htmlFor="logo-upload-input" className="relative cursor-pointer bg-white rounded-md font-medium text-slate-700 hover:text-slate-900 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-slate-500">
                                            <span>Alterar</span>
                                            <input id="logo-upload-input" name="logo-upload-input" type="file" className="sr-only" accept="image/*" onChange={handleLogoChange} />
                                        </label>
                                        <button type="button" onClick={handleRemoveLogo} className="font-medium text-red-600 hover:text-red-800">
                                            Remover
                                        </button>
                                    </div>
                                </>
                            ) : (
                                 <div className="space-y-1 text-center">
                                    <svg className="mx-auto h-12 w-12 text-slate-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                                        <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                    <div className="flex text-sm text-slate-600 justify-center">
                                        <label htmlFor="logo-upload-input" className="relative cursor-pointer bg-white rounded-md font-medium text-slate-700 hover:text-slate-900 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-slate-500">
                                            <span>Envie um arquivo</span>
                                            <input id="logo-upload-input" name="logo-upload-input" type="file" className="sr-only" accept="image/*" onChange={handleLogoChange} />
                                        </label>
                                    </div>
                                    <p className="text-xs text-slate-500">PNG, JPG até 2MB</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="md:col-span-2">
                        <label className={labelClass}>Cores</label>
                        <div className="mt-1 space-y-2">
                            <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <ColorPicker 
                                        color={formData.cores?.primaria || '#918B45'} 
                                        onChange={(value) => handleColorChange('primaria', value)} 
                                    />
                                    <div>
                                        <p className="font-medium text-slate-800">Primária</p>
                                        <p className="text-sm text-slate-500 uppercase font-mono">{formData.cores?.primaria || '#918B45'}</p>
                                    </div>
                                </div>
                            </div>
                             <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-sm">
                                <div className="flex items-center gap-3">
                                     <ColorPicker 
                                        color={formData.cores?.secundaria || '#4E6441'} 
                                        onChange={(value) => handleColorChange('secundaria', value)} 
                                    />
                                    <div>
                                        <p className="font-medium text-slate-800">Secundária</p>
                                        <p className="text-sm text-slate-500 uppercase font-mono">{formData.cores?.secundaria || '#4E6441'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

             <div className={sectionClass}>
                <h3 className={sectionTitleClass}>Configurações</h3>
                 <div className="mt-4 space-y-4">
                    <Input
                        id="proposalValidityDays"
                        label="Validade da Proposta (dias)"
                        type="number"
                        value={formData.proposalValidityDays ?? ''}
                        onChange={handleChange}
                        placeholder="Ex: 60"
                        min="1"
                    />
                    <Input
                        id="prazoPagamento"
                        label="Prazo de Pagamento"
                        type="text"
                        value={formData.prazoPagamento || ''}
                        onChange={handleChange}
                        placeholder="Ex: Pagamento imediato após a instalação"
                    />
                     <button
                        type="button"
                        onClick={onOpenPaymentMethods}
                        className="w-full px-4 py-3 bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
                        aria-label="Configurar Formas de Pagamento"
                    >
                        <i className="fas fa-dollar-sign"></i>
                        Configurar Formas de Pagamento
                    </button>
                 </div>
            </div>

            <div className={sectionClass}>
                <h3 className={sectionTitleClass}>Assinatura Digital</h3>
                <p className="text-sm text-slate-500 mt-2">
                    Crie uma assinatura para ser incluída automaticamente nos seus orçamentos em PDF.
                </p>
                <div className="mt-4 p-4 border-2 border-slate-200 border-dashed rounded-lg flex flex-col items-center justify-center min-h-[120px]">
                    {formData.assinatura ? (
                        <>
                            <img src={formData.assinatura} alt="Assinatura salva" className="max-h-20 max-w-full" />
                            <div className="mt-4 flex gap-4">
                                <button
                                    type="button"
                                    onClick={() => setIsSignatureModalOpen(true)}
                                    className="px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-200 hover:bg-slate-300 rounded-lg transition-colors"
                                >
                                    Alterar Assinatura
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFormData(prev => ({...prev, assinatura: ''}))}
                                    className="px-4 py-2 text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                                >
                                    Remover
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <p className="text-slate-500 mb-4">Nenhuma assinatura salva.</p>
                             <button
                                type="button"
                                onClick={() => setIsSignatureModalOpen(true)}
                                className="px-5 py-2.5 bg-slate-800 text-white font-semibold rounded-lg hover:bg-slate-700 transition duration-300 shadow-sm flex items-center justify-center gap-2"
                            >
                                <i className="fas fa-signature"></i>
                                Criar Assinatura
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className={sectionClass}>
                <h3 className={sectionTitleClass}>Horário de Funcionamento</h3>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input id="workingHours-start" label="Início do Expediente" type="time" value={formData.workingHours?.start || '08:00'} onChange={handleWorkingTimeChange} />
                    <Input id="workingHours-end" label="Fim do Expediente" type="time" value={formData.workingHours?.end || '18:00'} onChange={handleWorkingTimeChange} />
                </div>
                <div className="mt-4">
                    <label className={labelClass}>Dias da Semana</label>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
                        {['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'].map((dayName, index) => (
                            <label key={index} className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    checked={formData.workingHours?.days?.includes(index) || false}
                                    onChange={(e) => handleWorkingDayChange(index, e.target.checked)}
                                    className="h-4 w-4 rounded border-slate-300 text-slate-600 focus:ring-slate-500"
                                />
                                <span className="text-sm text-slate-700">{dayName}</span>
                            </label>
                        ))}
                    </div>
                </div>
            </div>
            
            <div className={sectionClass}>
                <h3 className={sectionTitleClass}>Equipe ({formData.employees?.length || 0})</h3>
                <p className="text-sm text-slate-500 mt-2">
                    A quantidade de colaboradores define quantos agendamentos podem ser feitos no mesmo horário.
                </p>
                <div className="mt-4 space-y-3">
                    {(formData.employees || []).map(employee => (
                        <div key={employee.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                            <span className="text-slate-800 font-medium">{employee.nome}</span>
                            <button type="button" onClick={() => handleRemoveEmployee(employee.id)} className="text-red-500 hover:text-red-700 h-8 w-8 rounded-full flex items-center justify-center hover:bg-red-50">
                                <i className="fas fa-trash-alt"></i>
                            </button>
                        </div>
                    ))}
                    <div className="flex items-center gap-2 pt-2">
                        <Input
                            id="newEmployee"
                            label=""
                            type="text"
                            value={newEmployeeName}
                            onChange={(e) => setNewEmployeeName((e.target as HTMLInputElement).value)}
                            placeholder="Nome do colaborador"
                        />
                        <button
                            type="button"
                            onClick={handleAddEmployee}
                            className="px-4 py-2.5 bg-slate-200 text-slate-700 font-semibold rounded-lg hover:bg-slate-300 transition-colors"
                        >
                            Adicionar
                        </button>
                    </div>
                </div>
            </div>

            <div className={sectionClass}>
                <h3 className={sectionTitleClass}>Configuração de Inteligência Artificial</h3>
                <p className="text-sm text-slate-500 mt-2">
                    Escolha um provedor de IA e insira sua chave de API para habilitar a função "Preencher com IA".
                </p>
                <div className="mt-4 space-y-4">
                     <Input
                        as="select"
                        id="aiProvider"
                        label="Provedor de IA"
                        value={formData.aiConfig?.provider || 'none'}
                        onChange={handleChange}
                    >
                        <option value="none">Desabilitado</option>
                        <option value="gemini">Google Gemini</option>
                        <option value="openai">OpenAI (GPT)</option>
                    </Input>

                    {formData.aiConfig?.provider !== 'none' && (
                        <Input
                            id="aiApiKey"
                            label="Sua Chave de API"
                            type="password"
                            value={formData.aiConfig?.apiKey || ''}
                            onChange={handleChange}
                            placeholder="Cole sua chave de API aqui"
                        />
                    )}
                </div>
            </div>
            
            <div className={`${sectionClass} flex justify-end items-center`}>
                <div className="flex items-center gap-4">
                    {showSuccess && (
                        <div className="text-green-600 font-medium text-sm flex items-center gap-2 transition-opacity duration-300">
                            <i className="fas fa-check-circle"></i>
                            <span>Salvo!</span>
                        </div>
                    )}
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="px-6 py-2.5 bg-slate-900 text-white font-semibold rounded-lg hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 disabled:bg-slate-500 disabled:cursor-wait min-w-[170px] text-center"
                    >
                         {isSaving ? (
                            <div className="loader-sm mx-auto"></div>
                         ) : (
                            'Salvar Alterações'
                         )}
                    </button>
                </div>
            </div>
            {isSignatureModalOpen && (
                <SignatureModal
                    isOpen={isSignatureModalOpen}
                    onClose={() => setIsSignatureModalOpen(false)}
                    onSave={handleSaveSignature}
                />
            )}
            <style jsx>{`
                .loader-sm {
                    border: 3px solid #f3f3f3;
                    border-top: 3px solid #fff;
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
        </form>
    );
};

export default UserSettingsView;