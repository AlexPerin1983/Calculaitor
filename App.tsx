

import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense, useRef } from 'react';
import { Client, Measurement, UserInfo, Film, PaymentMethods, SavedPDF, Agendamento, Budget } from './types';
import * as db from './services/db';
import { generatePDF } from './services/pdfGenerator';
import Header from './components/Header';
import ClientBar from './components/ClientBar';
import MeasurementList from './components/MeasurementList';
import SummaryBar from './components/SummaryBar';
import ActionsBar from './components/ActionsBar';
import MobileFooter from './components/MobileFooter';
import ClientModal from './components/modals/ClientModal';
import ClientSelectionModal from './components/modals/ClientSelectionModal';
import PaymentMethodsModal from './components/modals/PaymentMethodsModal';
import FilmModal from './components/modals/FilmModal';
import AIMeasurementModal from './components/modals/AIMeasurementModal';
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import ConfirmationModal from './components/modals/ConfirmationModal';
import CustomNumpad from './components/ui/CustomNumpad';
import FilmSelectionModal from './components/modals/FilmSelectionModal';
import PdfGenerationStatusModal from './components/modals/PdfGenerationStatusModal';
import AppHeader from './components/AppHeader';
import EditMeasurementModal from './components/modals/EditMeasurementModal';
import AgendamentoModal from './components/modals/AgendamentoModal';
import DiscountModal from './components/modals/DiscountModal';


const UserSettingsView = lazy(() => import('./components/views/UserSettingsView'));
const PdfHistoryView = lazy(() => import('./components/views/PdfHistoryView'));
const FilmListView = lazy(() => import('./components/views/FilmListView'));
const AgendaView = lazy(() => import('./components/views/AgendaView'));


type UIMeasurement = Measurement & { isNew?: boolean };
type ActiveTab = 'client' | 'films' | 'settings' | 'history' | 'agenda';

type NumpadConfig = {
    isOpen: boolean;
    measurementId: number | null;
    field: 'largura' | 'altura' | 'quantidade' | null;
    currentValue: string;
    shouldClearOnNextInput: boolean;
};

export type SchedulingInfo = {
    pdf: SavedPDF;
    agendamento?: Agendamento;
} | {
    agendamento: Partial<Agendamento>; // Use partial for new, standalone appointments
    pdf?: SavedPDF;
};

const BudgetTabs: React.FC<{
    budgets: Budget[];
    activeBudgetIndex: number;
    onSelect: (index: number) => void;
    onAdd: () => void;
    onDelete: (index: number) => void;
}> = ({ budgets, activeBudgetIndex, onSelect, onAdd, onDelete }) => {
    return (
        <div className="flex items-center space-x-2 p-1 bg-slate-100 rounded-lg mb-4 overflow-x-auto">
            {budgets.map((budget, index) => (
                <div key={budget.id} className="relative group">
                    <button 
                        onClick={() => onSelect(index)} 
                        className={`px-4 py-2 text-sm font-semibold rounded-md whitespace-nowrap transition-colors ${activeBudgetIndex === index ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:bg-white/60'}`}
                    >
                        {budget.name}
                    </button>
                    {budgets.length > 1 && (
                         <button 
                            onClick={() => onDelete(index)}
                            className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hidden sm:flex"
                            aria-label={`Excluir ${budget.name}`}
                        >
                            <i className="fas fa-times"></i>
                        </button>
                    )}
                </div>
            ))}
            <button onClick={onAdd} className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-slate-200 text-slate-600 rounded-md hover:bg-slate-300 transition-colors" aria-label="Adicionar nova opção de orçamento">
                <i className="fas fa-plus"></i>
            </button>
        </div>
    );
};


const App: React.FC = () => {
    const [isLoading, setIsLoading] = useState(true);
    const [clients, setClients] = useState<Client[]>([]);
    const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
    const [budgets, setBudgets] = useState<Budget[]>([]);
    const [activeBudgetIndex, setActiveBudgetIndex] = useState(0);
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
    const [films, setFilms] = useState<Film[]>([]);
    const [allSavedPdfs, setAllSavedPdfs] = useState<SavedPDF[]>([]);
    const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
    const [activeTab, setActiveTab] = useState<ActiveTab>('client');
    const [isDirty, setIsDirty] = useState(false);
    const [hasLoadedHistory, setHasLoadedHistory] = useState(false);
    const [hasLoadedAgendamentos, setHasLoadedAgendamentos] = useState(false);


    // Modal States
    const [isClientModalOpen, setIsClientModalOpen] = useState(false);
    const [isClientSelectionModalOpen, setIsClientSelectionModalOpen] = useState(false);
    const [clientModalMode, setClientModalMode] = useState<'add' | 'edit'>('add');
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [isFilmModalOpen, setIsFilmModalOpen] = useState(false);
    const [editingFilm, setEditingFilm] = useState<Film | null>(null);
    const [pdfGenerationStatus, setPdfGenerationStatus] = useState<'idle' | 'generating' | 'success'>('idle');
    const [isAIModalOpen, setIsAIModalOpen] = useState(false);
    const [isProcessingAI, setIsProcessingAI] = useState(false);
    const [isClearAllModalOpen, setIsClearAllModalOpen] = useState(false);
    const [filmToDeleteName, setFilmToDeleteName] = useState<string | null>(null);
    const [isDeleteClientModalOpen, setIsDeleteClientModalOpen] = useState(false);
    const [pdfToDeleteId, setPdfToDeleteId] = useState<number | null>(null);
    const [isFilmSelectionModalOpen, setIsFilmSelectionModalOpen] = useState(false);
    const [isApplyFilmToAllModalOpen, setIsApplyFilmToAllModalOpen] = useState(false);
    const [filmToApplyToAll, setFilmToApplyToAll] = useState<string | null>(null);
    const [editingMeasurementIdForFilm, setEditingMeasurementIdForFilm] = useState<number | null>(null);
    const [newClientName, setNewClientName] = useState<string>('');
    const [editingMeasurement, setEditingMeasurement] = useState<UIMeasurement | null>(null);
    const [schedulingInfo, setSchedulingInfo] = useState<SchedulingInfo | null>(null);
    const [agendamentoToDelete, setAgendamentoToDelete] = useState<Agendamento | null>(null);
    const [postClientSaveAction, setPostClientSaveAction] = useState<'openAgendamentoModal' | null>(null);
    const [editingMeasurementForDiscount, setEditingMeasurementForDiscount] = useState<UIMeasurement | null>(null);
    const [budgetToDeleteIndex, setBudgetToDeleteIndex] = useState<number | null>(null);

    const [numpadConfig, setNumpadConfig] = useState<NumpadConfig>({
        isOpen: false,
        measurementId: null,
        field: null,
        currentValue: '',
        shouldClearOnNextInput: false,
    });
    
    const mainRef = useRef<HTMLElement>(null);
    const numpadRef = useRef<HTMLDivElement>(null);
    
    const activeBudget = useMemo(() => budgets[activeBudgetIndex], [budgets, activeBudgetIndex]);
    const activeMeasurements = useMemo(() => activeBudget?.measurements || [], [activeBudget]);
    
    useEffect(() => {
        const mainEl = mainRef.current;
        if (!mainEl) return;
    
        if (numpadConfig.isOpen) {
            // Wait for numpad animation (200ms) to finish before getting height and scrolling.
            const timer = setTimeout(() => {
                if (numpadRef.current) {
                    const numpadHeight = numpadRef.current.offsetHeight;
                    // Add padding to the bottom of the scroll container to make space for the numpad.
                    mainEl.style.paddingBottom = `${numpadHeight}px`;
    
                    // Find the active measurement element and scroll it to a comfortable position.
                    if (numpadConfig.measurementId) {
                        const activeElement = mainEl.querySelector(`[data-measurement-id='${numpadConfig.measurementId}']`);
                        if (activeElement) {
                            const elementRect = activeElement.getBoundingClientRect();
                            const mainRect = mainEl.getBoundingClientRect();
                            
                            // We want to position the element in the upper part of the visible scroll area.
                            // Let's aim for about 30% from the top.
                            const targetY = mainRect.top + (mainEl.clientHeight * 0.3);
                            const scrollAmount = elementRect.top - targetY;

                            mainEl.scrollBy({
                                top: scrollAmount,
                                behavior: 'smooth'
                            });
                        }
                    }
                }
            }, 250);
            return () => clearTimeout(timer);
        } else {
            // Remove padding when numpad is closed, reverting to the class-based padding.
            mainEl.style.paddingBottom = '';
        }
    }, [numpadConfig.isOpen, numpadConfig.measurementId]);

    const loadClients = useCallback(async (clientIdToSelect?: number) => {
        const storedClients = await db.getAllClients();
        setClients(storedClients);
        if (clientIdToSelect) {
            setSelectedClientId(clientIdToSelect);
        } else if (storedClients.length > 0) {
            setSelectedClientId(storedClients[0].id!);
        } else {
            setSelectedClientId(null);
        }
    }, []);

    const loadFilms = useCallback(async () => {
        const customFilms = await db.getAllCustomFilms();
        const sortedFilms = customFilms.sort((a, b) => a.nome.localeCompare(b.nome));
        setFilms(sortedFilms);
    }, []);

    const loadAllPdfs = useCallback(async () => {
        const pdfs = await db.getAllPDFs();
        setAllSavedPdfs(pdfs);
    }, []);
    
    const loadAgendamentos = useCallback(async () => {
        const data = await db.getAllAgendamentos();
        setAgendamentos(data);
    }, []);

    const createDefaultBudget = (): Budget => ({
        id: Date.now(),
        name: 'Opção 1',
        measurements: [],
        generalDiscount: { value: '', type: 'percentage' },
    });

    useEffect(() => {
        const init = async () => {
            setIsLoading(true);
            await Promise.all([
                loadClients(),
                loadFilms(),
                db.getUserInfo().then(setUserInfo),
            ]);
            setIsLoading(false);
        };
        init();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    
    useEffect(() => {
        if (activeTab === 'history' && !hasLoadedHistory) {
            loadAllPdfs().then(() => setHasLoadedHistory(true));
        }
        if (activeTab === 'agenda' && !hasLoadedAgendamentos) {
            loadAgendamentos().then(() => setHasLoadedAgendamentos(true));
        }
    }, [activeTab, hasLoadedHistory, loadAllPdfs, hasLoadedAgendamentos, loadAgendamentos]);

    useEffect(() => {
        const loadDataForClient = async () => {
            if (selectedClientId) {
                const savedBudgets = await db.getBudgets(selectedClientId);
                if (savedBudgets && savedBudgets.length > 0) {
                    setBudgets(savedBudgets);
                } else {
                    setBudgets([createDefaultBudget()]);
                }
                setActiveBudgetIndex(0);
                setIsDirty(false);
            } else {
                setBudgets([]);
                setIsDirty(false);
            }
        };
        loadDataForClient();
    }, [selectedClientId]);

    const handleSaveChanges = useCallback(async () => {
        if (selectedClientId) {
            const budgetsToSave = budgets.map(budget => ({
                ...budget,
                measurements: budget.measurements.map(({ isNew, ...rest }) => rest)
            }));
            await db.saveBudgets(selectedClientId, budgetsToSave);
            setIsDirty(false);
        }
    }, [selectedClientId, budgets]);

    // Auto-save measurements
    useEffect(() => {
        if (!isDirty) {
            return;
        }
        const timerId = setTimeout(() => {
            handleSaveChanges();
        }, 1500); // Auto-save after 1.5 seconds of inactivity

        return () => clearTimeout(timerId);
    }, [budgets, isDirty, handleSaveChanges]);


    const handleMeasurementsChange = useCallback((newMeasurements: UIMeasurement[]) => {
        setBudgets(currentBudgets => {
            const newBudgets = [...currentBudgets];
            if (newBudgets[activeBudgetIndex]) {
                newBudgets[activeBudgetIndex] = {
                    ...newBudgets[activeBudgetIndex],
                    measurements: newMeasurements,
                };
            }
            return newBudgets;
        });
        setIsDirty(true);
    }, [activeBudgetIndex]);
    
    const handleGeneralDiscountChange = useCallback((newDiscount: { value: string; type: 'percentage' | 'fixed' }) => {
        setBudgets(currentBudgets => {
            const newBudgets = [...currentBudgets];
            if (newBudgets[activeBudgetIndex]) {
                newBudgets[activeBudgetIndex] = {
                    ...newBudgets[activeBudgetIndex],
                    generalDiscount: newDiscount,
                };
            }
            return newBudgets;
        });
        setIsDirty(true);
    }, [activeBudgetIndex]);


    const createEmptyMeasurement = useCallback((): Measurement => ({
        id: Date.now(),
        largura: '',
        altura: '',
        quantidade: 1,
        ambiente: 'Desconhecido',
        tipoAplicacao: 'Desconhecido',
        pelicula: films[0]?.nome || 'Nenhuma',
        active: true,
        discount: 0,
        discountType: 'percentage',
    }), [films]);
    
    const addMeasurement = useCallback(() => {
        const newMeasurement: UIMeasurement = { ...createEmptyMeasurement(), isNew: true };
        const updatedMeasurements = [
            newMeasurement, 
            ...activeMeasurements.map(m => ({ ...m, isNew: false }))
        ];
        handleMeasurementsChange(updatedMeasurements);
    }, [createEmptyMeasurement, activeMeasurements, handleMeasurementsChange]);
    
    const handleCreateNewBudgetOption = useCallback(() => {
        const budgetToCopy = activeBudget || createDefaultBudget();
    
        const newBudget: Budget = {
            id: Date.now(),
            name: `Opção ${budgets.length + 1}`,
            measurements: budgetToCopy.measurements.map(m => ({ 
                ...m, 
                id: Date.now() + Math.random(),
                isNew: false
            })),
            generalDiscount: { ...budgetToCopy.generalDiscount },
        };
    
        const newBudgets = [...budgets, newBudget];
        setBudgets(newBudgets);
        setActiveBudgetIndex(newBudgets.length - 1);
        setIsDirty(true);
    }, [budgets, activeBudget]);

    const handleConfirmClearAll = useCallback(() => {
        handleMeasurementsChange([]);
        setIsClearAllModalOpen(false);
    }, [handleMeasurementsChange]);

    const selectedClient = useMemo(() => {
        return clients.find(c => c.id === selectedClientId) || null;
    }, [clients, selectedClientId]);
    
    const handleNumpadClose = useCallback(() => {
        const { measurementId, field, currentValue } = numpadConfig;
        if (measurementId === null || field === null) {
            setNumpadConfig({ isOpen: false, measurementId: null, field: null, currentValue: '', shouldClearOnNextInput: false });
            return;
        }

        let finalValue: string | number = currentValue;
        if (field === 'quantidade') {
            finalValue = parseInt(currentValue, 10) || 1;
        } else {
            finalValue = (currentValue === '' || currentValue === '.') ? '0' : currentValue.replace('.', ',');
        }

        const updatedMeasurements = activeMeasurements.map(m =>
            m.id === measurementId ? { ...m, [field]: finalValue } : m
        );
        handleMeasurementsChange(updatedMeasurements);
        
        setNumpadConfig({ isOpen: false, measurementId: null, field: null, currentValue: '', shouldClearOnNextInput: false });
    }, [numpadConfig, activeMeasurements, handleMeasurementsChange]);

    const handleOpenClientModal = useCallback((mode: 'add' | 'edit') => {
        if (numpadConfig.isOpen) {
            handleNumpadClose();
        }
        setClientModalMode(mode);
        if (mode === 'edit' && !selectedClientId) {
            alert('Selecione um cliente para editar.');
            return;
        }
        setIsClientModalOpen(true);
    }, [selectedClientId, numpadConfig.isOpen, handleNumpadClose]);
    
    const handleOpenAgendamentoModal = useCallback((info: SchedulingInfo) => {
        setSchedulingInfo(info);
    }, []);

    const handleSaveClient = useCallback(async (client: Omit<Client, 'id'>) => {
        let savedClient: Client;
        if (clientModalMode === 'edit' && selectedClientId) {
            savedClient = await db.saveClient({ ...client, id: selectedClientId });
            setClients(clients.map(c => c.id === selectedClientId ? savedClient : c));
        } else {
            savedClient = await db.saveClient(client);
            setClients(prevClients => [savedClient, ...prevClients]);
        }
        setSelectedClientId(savedClient.id!);
        setIsClientModalOpen(false);
        setNewClientName('');

        if (postClientSaveAction === 'openAgendamentoModal') {
            handleOpenAgendamentoModal({
                agendamento: { clienteId: savedClient.id }
            });
            setPostClientSaveAction(null); // Reset the action
        }
    }, [clientModalMode, selectedClientId, clients, postClientSaveAction, handleOpenAgendamentoModal]);

    const handleDeleteClient = useCallback(() => {
        if (numpadConfig.isOpen) {
            handleNumpadClose();
        }
        if (!selectedClientId) {
            return;
        }
        setIsDeleteClientModalOpen(true);
    }, [selectedClientId, numpadConfig.isOpen, handleNumpadClose]);

    const handleConfirmDeleteClient = useCallback(async () => {
        if (!selectedClientId) return;

        await db.deleteClient(selectedClientId);
        await db.deleteMeasurements(selectedClientId);
        
        const pdfsForClient = await db.getPDFsForClient(selectedClientId);
        for (const pdf of pdfsForClient) {
            if (pdf.id) {
                await db.deletePDF(pdf.id);
            }
        }

        const remainingClients = clients.filter(c => c.id !== selectedClientId);
        setClients(remainingClients);
        setSelectedClientId(remainingClients.length > 0 ? remainingClients[0].id! : null);
        
        if (hasLoadedHistory) {
            await loadAllPdfs();
        }
        if (hasLoadedAgendamentos) {
            await loadAgendamentos();
        }
        
        setIsDeleteClientModalOpen(false);
    }, [selectedClientId, clients, hasLoadedHistory, loadAllPdfs, hasLoadedAgendamentos, loadAgendamentos]);
    
    const handleSaveUserInfo = useCallback(async (info: UserInfo) => {
        await db.saveUserInfo(info);
        setUserInfo(info);
    }, []);

    const handleSavePaymentMethods = useCallback(async (methods: PaymentMethods) => {
        if (userInfo) {
            const updatedUserInfo = { ...userInfo, payment_methods: methods };
            await db.saveUserInfo(updatedUserInfo);
            setUserInfo(updatedUserInfo);
            setIsPaymentModalOpen(false);
        }
    }, [userInfo]);
    
    const handleOpenFilmModal = useCallback((film: Film | null) => {
        setEditingFilm(film);
        setIsFilmModalOpen(true);
    }, []);

    const handleEditFilmFromSelection = useCallback((film: Film) => {
        setIsFilmSelectionModalOpen(false);
        setIsApplyFilmToAllModalOpen(false);
        setEditingMeasurementIdForFilm(null);
        handleOpenFilmModal(film);
    }, [handleOpenFilmModal]);

    const handleSaveFilm = useCallback(async (newFilmData: Film, originalFilm: Film | null) => {
        if (originalFilm && originalFilm.nome !== newFilmData.nome) {
            await db.deleteCustomFilm(originalFilm.nome);
        }
    
        await db.saveCustomFilm(newFilmData);
        await loadFilms();
        setIsFilmModalOpen(false);
        setEditingFilm(null);
    }, [loadFilms]);

    const handleDeleteFilm = useCallback(async (filmName: string) => {
        if (window.confirm(`Tem certeza que deseja excluir a película "${filmName}"?`)) {
            await db.deleteCustomFilm(filmName);
            await loadFilms();
            setIsFilmModalOpen(false);
            setEditingFilm(null);
        }
    }, [loadFilms]);

    const handleRequestDeleteFilm = useCallback((filmName: string) => {
        setIsFilmSelectionModalOpen(false);
        setFilmToDeleteName(filmName);
    }, []);

    const handleConfirmDeleteFilm = useCallback(async () => {
        if (filmToDeleteName === null) return;
        await db.deleteCustomFilm(filmToDeleteName);
        await loadFilms();
        setFilmToDeleteName(null);
    }, [filmToDeleteName, loadFilms]);


    const downloadBlob = useCallback((blob: Blob, filename: string) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, []);
    
    const totals = useMemo(() => {
        if (!activeBudget) return { totalM2: 0, subtotal: 0, totalItemDiscount: 0, priceAfterItemDiscounts: 0, generalDiscountAmount: 0, finalTotal: 0 };

        const result = activeBudget.measurements.reduce((acc, m) => {
            if (m.active) {
                const largura = parseFloat(m.largura.replace(',', '.')) || 0;
                const altura = parseFloat(m.altura.replace(',', '.')) || 0;
                const quantidade = parseInt(String(m.quantidade), 10) || 0;
                const m2 = largura * altura * quantidade;
                const film = films.find(f => f.nome === m.pelicula);
                const basePrice = film ? m2 * film.preco : 0;

                let itemDiscountAmount = 0;
                const discountValue = m.discount || 0;
                if (m.discountType === 'percentage' && discountValue > 0) {
                    itemDiscountAmount = basePrice * (discountValue / 100);
                } else if (m.discountType === 'fixed' && discountValue > 0) {
                    itemDiscountAmount = discountValue;
                }
                
                const finalItemPrice = Math.max(0, basePrice - itemDiscountAmount);
                
                acc.totalM2 += m2;
                acc.subtotal += basePrice;
                acc.totalItemDiscount += itemDiscountAmount;
                acc.priceAfterItemDiscounts += finalItemPrice;
            }
            return acc;
        }, { totalM2: 0, subtotal: 0, totalItemDiscount: 0, priceAfterItemDiscounts: 0 });

        let generalDiscountAmount = 0;
        const discountInputValue = parseFloat(String(activeBudget.generalDiscount.value).replace(',', '.')) || 0;
        if (discountInputValue > 0) {
            if (activeBudget.generalDiscount.type === 'percentage') {
                generalDiscountAmount = result.priceAfterItemDiscounts * (discountInputValue / 100);
            } else if (activeBudget.generalDiscount.type === 'fixed') {
                generalDiscountAmount = discountInputValue;
            }
        }
        
        const finalTotal = Math.max(0, result.priceAfterItemDiscounts - generalDiscountAmount);

        return {
            ...result,
            generalDiscountAmount,
            finalTotal,
        };
    }, [activeBudget, films]);

    const handleGeneratePdf = useCallback(async () => {
        if (!selectedClient || !userInfo || !activeBudget) {
            alert("Selecione um cliente e preencha as informações da empresa antes de gerar o PDF.");
            return;
        }
        if (isDirty) {
            if(window.confirm("Você tem alterações não salvas. Deseja salvar antes de gerar o PDF?")) {
                await handleSaveChanges();
            } else {
                alert("Geração de PDF cancelada. Salve ou descarte suas alterações.");
                return;
            }
        }
        const activeMeasurementsForPdf = activeMeasurements.filter(m => m.active && parseFloat(String(m.largura).replace(',', '.')) > 0 && parseFloat(String(m.altura).replace(',', '.')) > 0);
        if(activeMeasurementsForPdf.length === 0) {
            alert("Não há medidas válidas para gerar um orçamento.");
            return;
        }

        setPdfGenerationStatus('generating');
        try {
            const pdfBlob = await generatePDF(selectedClient, userInfo, activeMeasurementsForPdf, films, activeBudget.generalDiscount, totals);
            const filename = `orcamento_${selectedClient.nome.replace(/\s+/g, '_').toLowerCase()}_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.pdf`;
            
            const generalDiscountForDb: SavedPDF['generalDiscount'] = {
                ...activeBudget.generalDiscount,
                value: parseFloat(String(activeBudget.generalDiscount.value).replace(',', '.')) || 0,
                type: activeBudget.generalDiscount.value ? activeBudget.generalDiscount.type : 'none',
            };
            
            const validityDays = userInfo.proposalValidityDays || 60;
            const issueDate = new Date();
            const expirationDate = new Date();
            expirationDate.setDate(issueDate.getDate() + validityDays);

            const pdfToSave: Omit<SavedPDF, 'id'> = {
                clienteId: selectedClientId!,
                date: issueDate.toISOString(),
                expirationDate: expirationDate.toISOString(),
                totalPreco: totals.finalTotal,
                totalM2: totals.totalM2,
                subtotal: totals.subtotal,
                generalDiscountAmount: totals.generalDiscountAmount,
                generalDiscount: generalDiscountForDb,
                pdfBlob: pdfBlob,
                nomeArquivo: filename,
                measurements: activeMeasurementsForPdf.map(({ isNew, ...rest }) => rest),
                status: 'pending'
            };
            await db.savePDF(pdfToSave);
            
            downloadBlob(pdfBlob, filename);
            
            setPdfGenerationStatus('success');
            
            if (hasLoadedHistory) {
                await loadAllPdfs();
            }
        } catch (error) {
            console.error("Erro ao gerar ou salvar PDF:", error);
            alert("Ocorreu um erro ao gerar o PDF. Verifique o console para mais detalhes.");
            setPdfGenerationStatus('idle');
        }
    }, [selectedClient, userInfo, isDirty, handleSaveChanges, activeMeasurements, films, activeBudget, totals, selectedClientId, downloadBlob, hasLoadedHistory, loadAllPdfs]);

    const handleGoToHistoryFromPdf = useCallback(() => {
        setPdfGenerationStatus('idle');
        setActiveTab('history');
    }, []);

    const handleClosePdfStatusModal = useCallback(() => {
        setPdfGenerationStatus('idle');
    }, []);

    const blobToBase64 = (blob: Blob): Promise<{mimeType: string, data: string}> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64data = reader.result as string;
                const parts = base64data.split(',');
                const mimeType = parts[0].match(/:(.*?);/)?.[1] || blob.type;
                resolve({ mimeType, data: parts[1] });
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    };

    const processWithGemini = async (apiKey: string, input: { type: 'text' | 'image' | 'audio'; data: string | File[] | Blob }) => {
        const ai = new GoogleGenAI({ apiKey });
        const schema = {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    largura: { type: Type.STRING, description: 'A largura da medida em metros. Ex: "1,20" ou "1.20". Deve ser uma string.' },
                    altura: { type: Type.STRING, description: 'A altura da medida em metros. Ex: "2,10" ou "2.10". Deve ser uma string.' },
                    quantidade: { type: Type.INTEGER, description: 'A quantidade de itens com essa medida.' },
                    ambiente: { type: Type.STRING, description: 'O local da medida (ex: "Sala", "Cozinha"). Se não especificado, use "Desconhecido".' },
                    tipoAplicacao: { type: Type.STRING, description: 'O tipo de aplicação (ex: "Janela", "Porta"). Se não especificado, use "Desconhecido".' },
                    pelicula: { type: Type.STRING, description: 'O nome da película a ser aplicada (ex: "Color Stable", "Vinil Jateado"). Se não for especificada, use "Desconhecido".' },
                },
                required: ['largura', 'altura', 'quantidade']
            }
        };
        const basePrompt = `Extraia as medidas, incluindo largura, altura, quantidade, ambiente, tipo de aplicação e nome da película. Retorne como um JSON formatado. Se ambiente, tipo de aplicação ou película não forem especificados, use "Desconhecido" para esses campos. Padronize os valores se possível. Os números de largura e altura devem ser strings.`;

        let modelRequest: { model: string; contents: any; config: any; };

        if (input.type === 'text') {
            modelRequest = { model: 'gemini-2.5-flash', contents: `${basePrompt} Texto do usuário: "${input.data}"`, config: { responseMimeType: "application/json", responseSchema: schema } };
        } else if (input.type === 'image') {
            const imageFiles = input.data as File[];
            const imageParts = await Promise.all(imageFiles.map(async (file) => {
                const { mimeType, data: base64Data } = await blobToBase64(file);
                return { inlineData: { mimeType, data: base64Data } };
            }));
            modelRequest = { model: 'gemini-2.5-flash', contents: { parts: [...imageParts, { text: `${basePrompt} Analise a(s) imagem(ns) em busca de medidas.` }] }, config: { responseMimeType: "application/json", responseSchema: schema } };
        } else if (input.type === 'audio') {
            const { mimeType, data: base64Data } = await blobToBase64(input.data as Blob);
            modelRequest = { model: 'gemini-2.5-flash', contents: { parts: [{ inlineData: { mimeType, data: base64Data } }, { text: `${basePrompt} Transcreva o áudio e analise o texto em busca de medidas.` }] }, config: { responseMimeType: "application/json", responseSchema: schema } };
        } else {
            throw new Error("Tipo de entrada de IA inválido");
        }
        
        const response: GenerateContentResponse = await ai.models.generateContent(modelRequest);
        return JSON.parse(response.text.trim());
    };
    
    const processWithOpenAI = async (apiKey: string, input: { type: 'text' | 'image' | 'audio'; data: string | File[] | Blob }) => {
        if (input.type === 'audio') {
            throw new Error('O processamento de áudio com OpenAI não é suportado no momento.');
        }
        
        const schemaForOpenAI = `{ "type": "object", "properties": { "medidas": { "type": "array", "items": { "type": "object", "properties": { "largura": { "type": "string" }, "altura": { "type": "string" }, "quantidade": { "type": "integer" }, "ambiente": { "type": "string" }, "tipoAplicacao": { "type": "string" }, "pelicula": { "type": "string" } }, "required": ["largura", "altura", "quantidade"] } } }, "required": ["medidas"] }`;
        const basePrompt = `Extraia as medidas do conteúdo. Retorne APENAS um objeto JSON válido que corresponda a este schema: ${schemaForOpenAI}. Use "Desconhecido" para campos não especificados.`;

        const messages: any[] = [];
        if (input.type === 'text') {
            messages.push({ role: 'user', content: `${basePrompt}\n\nTexto: "${input.data}"` });
        } else if (input.type === 'image') {
            const imageFiles = input.data as File[];
            const imageContents = await Promise.all(imageFiles.map(async (file) => {
                const { data: base64Data } = await blobToBase64(file);
                return { type: 'image_url', image_url: { url: `data:${file.type};base64,${base64Data}` } };
            }));
            messages.push({ role: 'user', content: [{ type: 'text', text: basePrompt }, ...imageContents] });
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ model: 'gpt-4o', messages, response_format: { type: "json_object" } })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Erro da API OpenAI: ${errorData.error.message}`);
        }

        const result = await response.json();
        const parsedObject = JSON.parse(result.choices[0].message.content);
        return parsedObject.medidas || [];
    };

    const handleProcessAIMeasurements = useCallback(async (input: { type: 'text' | 'image' | 'audio'; data: string | File[] | Blob }) => {
        const { aiConfig } = userInfo || {};
        if (!aiConfig?.apiKey || aiConfig.provider === 'none') {
            alert("Por favor, configure sua chave de API na aba 'Empresa' para usar a funcionalidade de IA.");
            return;
        }

        setIsProcessingAI(true);
        try {
            let parsedMeasurements: any[] = [];
            if (aiConfig.provider === 'gemini') {
                parsedMeasurements = await processWithGemini(aiConfig.apiKey, input);
            } else if (aiConfig.provider === 'openai') {
                 parsedMeasurements = await processWithOpenAI(aiConfig.apiKey, input);
            } else {
                 throw new Error("Provedor de IA desconhecido.");
            }
    
            if (!Array.isArray(parsedMeasurements)) {
                throw new Error("A resposta da IA não é um array válido.");
            }
    
            const newMeasurements: UIMeasurement[] = parsedMeasurements.map((item: any, index: number) => {
                const filmExists = films.some(f => f.nome.toLowerCase() === (item.pelicula || '').toLowerCase());
                return {
                    id: Date.now() + index,
                    largura: String(item.largura || '').replace('.', ','),
                    altura: String(item.altura || '').replace('.', ','),
                    quantidade: Number(item.quantidade || 1),
                    ambiente: item.ambiente || 'Desconhecido',
                    tipoAplicacao: item.tipoAplicacao || 'Desconhecido',
                    pelicula: filmExists ? item.pelicula : (films[0]?.nome || 'Nenhuma'),
                    active: true,
                    isNew: index === 0,
                    discount: 0,
                    discountType: 'percentage',
                };
            });
    
            if (newMeasurements.length === 0) {
                alert("Nenhuma medida foi extraída. Tente descrever de outra forma.");
            } else {
                const updatedMeasurements = [
                    ...newMeasurements,
                    ...activeMeasurements.map(m => ({ ...m, isNew: false }))
                ];
                handleMeasurementsChange(updatedMeasurements);
                setIsAIModalOpen(false);
            }
        } catch (error) {
            console.error("Erro ao processar com IA:", error);
            alert(`Ocorreu um erro ao interpretar as medidas: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setIsProcessingAI(false);
        }
    }, [userInfo, films, activeMeasurements, handleMeasurementsChange]);
    
    const handleProcessAIClientInfo = useCallback(async (files: File[]): Promise<Partial<Client>> => {
        const { aiConfig } = userInfo || {};
        if (!aiConfig?.apiKey || aiConfig.provider === 'none') {
            throw new Error("Por favor, configure sua chave de API na aba 'Empresa' para usar a funcionalidade de IA.");
        }
        if (aiConfig.provider !== 'gemini') {
            throw new Error("A extração de dados do cliente por imagem só está disponível com o provedor Gemini no momento.");
        }

        try {
            const ai = new GoogleGenAI({ apiKey: aiConfig.apiKey });
            const clientSchema = {
                type: Type.OBJECT,
                properties: {
                    nome: { type: Type.STRING, description: 'O nome completo do cliente ou da empresa.' },
                    telefone: { type: Type.STRING, description: 'O número de telefone de contato. Tente formatar como (XX) XXXXX-XXXX.' },
                    endereco: { type: Type.STRING, description: 'O endereço completo.' },
                    cpfCnpj: { type: Type.STRING, description: 'O CPF ou CNPJ, se houver.' },
                    email: { type: Type.STRING, description: 'O endereço de e-mail.' },
                },
            };
            const prompt = "Extraia as informações de contato do cliente da(s) imagem(ns). Combine as informações de todas as imagens para criar um perfil de cliente completo. Retorne um objeto JSON formatado. Se alguma informação não estiver presente, omita o campo do JSON.";

            const imageParts = await Promise.all(files.map(async (file) => {
                const { mimeType, data: base64Data } = await blobToBase64(file);
                return { inlineData: { mimeType, data: base64Data } };
            }));
            
            const response: GenerateContentResponse = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: { parts: [...imageParts, { text: prompt }] },
                config: { responseMimeType: "application/json", responseSchema: clientSchema }
            });

            const parsedData = JSON.parse(response.text.trim());
            // Adapt to the new structured address
            const { endereco, ...rest } = parsedData;
            return { ...rest, logradouro: endereco };

        } catch (error) {
            console.error("Erro ao processar imagem(ns) do cliente com IA:", error);
            throw new Error(`Ocorreu um erro ao extrair os dados da(s) imagem(ns). Verifique sua chave de API e conexão. Detalhes: ${error instanceof Error ? error.message : String(error)}`);
        }
    }, [userInfo]);

    const handleRequestDeletePdf = useCallback((pdfId: number) => {
        setPdfToDeleteId(pdfId);
    }, []);

    const handleConfirmDeletePdf = useCallback(async () => {
        if (pdfToDeleteId === null) return;
        await db.deletePDF(pdfToDeleteId);
        await loadAllPdfs();
        if(hasLoadedAgendamentos) {
            await loadAgendamentos();
        }
        setPdfToDeleteId(null);
    }, [pdfToDeleteId, loadAllPdfs, hasLoadedAgendamentos, loadAgendamentos]);
    
    const handleUpdatePdfStatus = useCallback(async (pdfId: number, status: SavedPDF['status']) => {
        try {
            const allPdfsFromDb = await db.getAllPDFs();
            const pdfToUpdate = allPdfsFromDb.find(p => p.id === pdfId);
            
            if (pdfToUpdate) {
                const updatedPdf = { ...pdfToUpdate, status };
                await db.updatePDF(updatedPdf);
                await loadAllPdfs();
            }
        } catch (error) {
            console.error("Failed to update PDF status", error);
            alert("Não foi possível atualizar o status do orçamento.");
        }
    }, [loadAllPdfs]);


    const toggleFullScreen = useCallback(() => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
            });
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    }, []);

    const handleOpenNumpad = useCallback((measurementId: number, field: 'largura' | 'altura' | 'quantidade', currentValue: string | number) => {
        const { isOpen, measurementId: prevId, field: prevField, currentValue: prevValue } = numpadConfig;

        // Save previous value if switching inputs
        if (isOpen && (prevId !== measurementId || prevField !== field)) {
            let finalValue: string | number = prevValue;
            if (prevField === 'quantidade') {
                finalValue = parseInt(prevValue, 10) || 1;
            } else {
                finalValue = (prevValue === ',' || prevValue === '' || prevValue === '.') ? '0' : prevValue.replace('.', ',');
            }

            const updatedMeasurements = activeMeasurements.map(m =>
                m.id === prevId ? { ...m, [prevField!]: finalValue } : m
            );
            handleMeasurementsChange(updatedMeasurements);
        }

        // Now, set the new numpad config
        setNumpadConfig(prev => {
            const isSameButton = prev.isOpen && prev.measurementId === measurementId && prev.field === field;
            
            if (isSameButton) {
                // Tapped same button again, switch to edit mode
                return {
                    ...prev,
                    shouldClearOnNextInput: false,
                };
            }

            // New focus, switch to replace mode
            return {
                isOpen: true,
                measurementId,
                field,
                currentValue: String(currentValue).replace(',', '.'),
                shouldClearOnNextInput: true,
            };
        });
    }, [numpadConfig, activeMeasurements, handleMeasurementsChange]);

    const handleNumpadDone = useCallback(() => {
        const { measurementId, field, currentValue } = numpadConfig;
        if (measurementId === null || field === null) return;

        let finalValue: string | number = currentValue;
        if (field === 'quantidade') {
            finalValue = parseInt(currentValue, 10) || 1;
        } else {
            finalValue = (currentValue === '' || currentValue === '.') ? '0' : currentValue.replace('.', ',');
        }

        const updatedMeasurements = activeMeasurements.map(m =>
            m.id === measurementId ? { ...m, [field]: finalValue } : m
        );
        handleMeasurementsChange(updatedMeasurements);

        const fieldSequence: Array<'largura' | 'altura' | 'quantidade'> = ['largura', 'altura', 'quantidade'];
        const currentIndex = fieldSequence.indexOf(field);
        const nextIndex = currentIndex + 1;

        if (nextIndex < fieldSequence.length) {
            const nextField = fieldSequence[nextIndex];
            const currentMeasurement = updatedMeasurements.find(m => m.id === measurementId);
            const nextValue = currentMeasurement ? currentMeasurement[nextField] : '';

            setNumpadConfig({
                isOpen: true,
                measurementId,
                field: nextField,
                currentValue: String(nextValue).replace(',', '.'),
                shouldClearOnNextInput: true,
            });
        } else {
            setNumpadConfig({ isOpen: false, measurementId: null, field: null, currentValue: '', shouldClearOnNextInput: false });
        }
    }, [numpadConfig, activeMeasurements, handleMeasurementsChange]);

    const handleNumpadInput = useCallback((value: string) => {
        setNumpadConfig(prev => {
            const shouldClear = prev.shouldClearOnNextInput;
            let newValue = prev.currentValue;

            const char = value === ',' ? '.' : value;

            if (char === '.') {
                if (prev.field !== 'quantidade') {
                    newValue = shouldClear ? '0.' : (newValue.includes('.') ? newValue : newValue + '.');
                }
            } else {
                newValue = shouldClear ? char : newValue + char;
            }

            const isWidthOrHeight = prev.field === 'largura' || prev.field === 'altura';
            const matchesPattern = /^\d\.\d{2}$/.test(newValue);

            if (isWidthOrHeight && matchesPattern) {
                const finalValue = newValue.replace('.', ',');
                const measurementsWithSavedValue = activeMeasurements.map(m =>
                    m.id === prev.measurementId ? { ...m, [prev.field!]: finalValue } : m
                );
                handleMeasurementsChange(measurementsWithSavedValue);

                const fieldSequence: Array<'largura' | 'altura' | 'quantidade'> = ['largura', 'altura', 'quantidade'];
                const currentIndex = fieldSequence.indexOf(prev.field!);
                const nextIndex = currentIndex + 1;

                if (nextIndex < fieldSequence.length) {
                    const nextField = fieldSequence[nextIndex];
                    const currentMeasurement = measurementsWithSavedValue.find(m => m.id === prev.measurementId);
                    const nextValueForField = currentMeasurement ? currentMeasurement[nextField] : '';
                    
                    return {
                        isOpen: true,
                        measurementId: prev.measurementId,
                        field: nextField,
                        currentValue: String(nextValueForField).replace(',', '.'),
                        shouldClearOnNextInput: true,
                    };
                } else {
                    return { isOpen: false, measurementId: null, field: null, currentValue: '', shouldClearOnNextInput: false };
                }
            }

            return { ...prev, currentValue: newValue, shouldClearOnNextInput: false };
        });
    }, [activeMeasurements, handleMeasurementsChange]);

    const handleNumpadDelete = useCallback(() => {
        setNumpadConfig(prev => ({ 
            ...prev, 
            currentValue: prev.currentValue.slice(0, -1),
            shouldClearOnNextInput: false 
        }));
    }, []);

    const handleNumpadDuplicate = useCallback(() => {
        const { measurementId, field, currentValue } = numpadConfig;
        if (measurementId === null || field === null) return;

        let finalValue: string | number = currentValue;
        if (field === 'quantidade') {
            finalValue = parseInt(currentValue, 10) || 1;
        } else {
            finalValue = (currentValue === '' || currentValue === '.') ? '0' : currentValue.replace('.', ',');
        }

        const measurementsWithSavedValue = activeMeasurements.map(m =>
            m.id === measurementId ? { ...m, [field]: finalValue } : m
        );
        
        const measurementToDuplicate = measurementsWithSavedValue.find(m => m.id === measurementId);
        
        if (measurementToDuplicate) {
            const newMeasurement: UIMeasurement = { 
                ...measurementToDuplicate, 
                id: Date.now(), 
                isNew: true
            };
            
            const index = measurementsWithSavedValue.findIndex(m => m.id === measurementId);
            const finalMeasurements = [...measurementsWithSavedValue];
            finalMeasurements.splice(index + 1, 0, newMeasurement);
            
            handleMeasurementsChange(finalMeasurements.map(m => 
                m.id === newMeasurement.id ? m : { ...m, isNew: false }
            ));

            setNumpadConfig({ isOpen: false, measurementId: null, field: null, currentValue: '', shouldClearOnNextInput: false });
        }
    }, [numpadConfig, activeMeasurements, handleMeasurementsChange]);

    const handleNumpadClear = useCallback(() => {
        const { measurementId, field } = numpadConfig;
        if (measurementId === null) return;

        const updatedMeasurements = activeMeasurements.map(m =>
            m.id === measurementId ? { ...m, largura: '', altura: '', quantidade: 1 } : m
        );
        handleMeasurementsChange(updatedMeasurements);

        setNumpadConfig(prev => ({
            ...prev,
            currentValue: field === 'quantidade' ? '1' : '',
            shouldClearOnNextInput: true,
        }));
    }, [numpadConfig, activeMeasurements, handleMeasurementsChange]);

    const handleNumpadAddGroup = useCallback(() => {
        const { measurementId, field, currentValue } = numpadConfig;
    
        let measurementsWithSavedValue = activeMeasurements;
        if (measurementId !== null && field !== null) {
            let finalValue: string | number = currentValue;
            if (field === 'quantidade') {
                finalValue = parseInt(currentValue, 10) || 1;
            } else {
                finalValue = (currentValue === '' || currentValue === '.') ? '0' : currentValue.replace('.', ',');
            }
            measurementsWithSavedValue = activeMeasurements.map(m =>
                m.id === measurementId ? { ...m, [field]: finalValue } : m
            );
        }

        const newMeasurement: UIMeasurement = { ...createEmptyMeasurement(), isNew: true };
        const finalMeasurements = [
            newMeasurement,
            ...measurementsWithSavedValue.map(m => ({ ...m, isNew: false }))
        ];
        
        handleMeasurementsChange(finalMeasurements);
        
        setNumpadConfig({ isOpen: false, measurementId: null, field: null, currentValue: '', shouldClearOnNextInput: false });
    }, [numpadConfig, createEmptyMeasurement, activeMeasurements, handleMeasurementsChange]);

    const handleTabChange = useCallback((tab: ActiveTab) => {
        if (numpadConfig.isOpen) {
            handleNumpadClose();
        }
        setActiveTab(tab);
    }, [numpadConfig.isOpen, handleNumpadClose]);

    const handleOpenFilmSelectionModal = useCallback((measurementId: number) => {
        if (numpadConfig.isOpen) {
            handleNumpadClose();
        }
        setEditingMeasurementIdForFilm(measurementId);
        setIsFilmSelectionModalOpen(true);
    }, [numpadConfig.isOpen, handleNumpadClose]);

    const handleSelectFilmForMeasurement = useCallback((filmName: string) => {
        if (editingMeasurementIdForFilm === null) return;

        const updatedMeasurements = activeMeasurements.map(m => 
            m.id === editingMeasurementIdForFilm ? { ...m, pelicula: filmName } : m
        );
        handleMeasurementsChange(updatedMeasurements);
        
        setIsFilmSelectionModalOpen(false);
        setEditingMeasurementIdForFilm(null);
    }, [editingMeasurementIdForFilm, activeMeasurements, handleMeasurementsChange]);

    const handleApplyFilmToAll = useCallback((filmName: string) => {
        setIsApplyFilmToAllModalOpen(false);
        setFilmToApplyToAll(filmName);
    }, []);
    
    const handleConfirmApplyFilmToAll = useCallback(() => {
        if (!filmToApplyToAll) return;

        const updatedMeasurements = activeMeasurements.map(m => ({ ...m, pelicula: filmToApplyToAll }));
        handleMeasurementsChange(updatedMeasurements);
        setFilmToApplyToAll(null);
    }, [filmToApplyToAll, activeMeasurements, handleMeasurementsChange]);

    const handleAddNewFilmFromSelection = useCallback((filmName: string) => {
        setIsFilmSelectionModalOpen(false);
        setIsApplyFilmToAllModalOpen(false);
        setEditingMeasurementIdForFilm(null);
        const newFilmTemplate: Film = {
            nome: filmName,
            preco: 0,
            garantiaFabricante: 0,
            garantiaMaoDeObra: 30,
            uv: 0,
            ir: 0,
            vtl: 0,
            espessura: 0,
            tser: 0,
        };
        handleOpenFilmModal(newFilmTemplate);
    }, [handleOpenFilmModal]);
    
    const handleAddNewClientFromSelection = useCallback((clientName: string) => {
        setIsClientSelectionModalOpen(false);
        setClientModalMode('add');
        setNewClientName(clientName);
        setIsClientModalOpen(true);
    }, []);

    const handleOpenEditMeasurementModal = useCallback((measurement: UIMeasurement) => {
        if (numpadConfig.isOpen) {
            handleNumpadClose();
        }
        setEditingMeasurement(measurement);
    }, [numpadConfig.isOpen, handleNumpadClose]);

    const handleCloseEditMeasurementModal = useCallback(() => {
        setEditingMeasurement(null);
    }, []);

    const handleUpdateEditingMeasurement = useCallback((updatedData: Partial<Measurement>) => {
        if (!editingMeasurement) return;
        const updatedMeasurement = { ...editingMeasurement, ...updatedData };
        setEditingMeasurement(updatedMeasurement); // Update state for modal
        const newMeasurements = activeMeasurements.map(m => m.id === updatedMeasurement.id ? updatedMeasurement : m);
        handleMeasurementsChange(newMeasurements);
    }, [editingMeasurement, activeMeasurements, handleMeasurementsChange]);

    const handleCloseAgendamentoModal = useCallback(() => {
        setSchedulingInfo(null);
    }, []);

    const handleSaveAgendamento = useCallback(async (agendamentoData: Omit<Agendamento, 'id'> | Agendamento) => {
        try {
            const savedAgendamento = await db.saveAgendamento(agendamentoData);
    
            if (savedAgendamento.pdfId) {
                const allPdfsFromDb = await db.getAllPDFs();
                const pdfToUpdate = allPdfsFromDb.find(p => p.id === savedAgendamento.pdfId);
                
                if (pdfToUpdate && pdfToUpdate.agendamentoId !== savedAgendamento.id) {
                    await db.updatePDF({ ...pdfToUpdate, agendamentoId: savedAgendamento.id });
                }
            }
            
            await Promise.all([loadAgendamentos(), loadAllPdfs()]);
    
            handleCloseAgendamentoModal();
        } catch (error) {
            console.error("Erro ao salvar agendamento:", error);
            alert("Não foi possível salvar o agendamento. Tente novamente.");
        }
    }, [handleCloseAgendamentoModal, loadAgendamentos, loadAllPdfs]);

    const handleRequestDeleteAgendamento = useCallback((agendamento: Agendamento) => {
        handleCloseAgendamentoModal();
        setAgendamentoToDelete(agendamento);
    }, [handleCloseAgendamentoModal]);

    const handleConfirmDeleteAgendamento = useCallback(async () => {
        if (!agendamentoToDelete?.id) return;

        try {
            const agendamentoId = agendamentoToDelete.id;
            const allPdfsFromDb = await db.getAllPDFs();
            const pdfToUnlink = allPdfsFromDb.find(p => p.agendamentoId === agendamentoId);
            
            await db.deleteAgendamento(agendamentoId);
            
            if (pdfToUnlink) {
                const updatedPdf = { ...pdfToUnlink };
                delete updatedPdf.agendamentoId;
                await db.updatePDF(updatedPdf);
            }
            
            await Promise.all([loadAgendamentos(), loadAllPdfs()]);
        } catch (error) {
            console.error("Erro ao excluir agendamento:", error);
            alert("Não foi possível excluir o agendamento. Tente novamente.");
        } finally {
            setAgendamentoToDelete(null);
        }
    }, [agendamentoToDelete, loadAgendamentos, loadAllPdfs]);
    
    const handleAddNewClientFromAgendamento = useCallback((clientName: string) => {
        handleCloseAgendamentoModal();
        setPostClientSaveAction('openAgendamentoModal');
        setClientModalMode('add');
        setNewClientName(clientName);
        setIsClientModalOpen(true);
    }, [handleCloseAgendamentoModal]);

    const handleCreateNewAgendamento = useCallback((date: Date) => {
        const startDate = new Date(date);
        startDate.setHours(9, 0, 0, 0);

        handleOpenAgendamentoModal({
            agendamento: {
                start: startDate.toISOString(),
            }
        });
    }, [handleOpenAgendamentoModal]);

    const handleOpenClientSelectionModal = useCallback(() => {
        if (numpadConfig.isOpen) {
            handleNumpadClose();
        }
        setIsClientSelectionModalOpen(true);
    }, [numpadConfig.isOpen, handleNumpadClose]);

    const handleOpenDiscountModal = useCallback((measurement: UIMeasurement) => {
        if (numpadConfig.isOpen) {
            handleNumpadClose();
        }
        setEditingMeasurementForDiscount(measurement);
    }, [numpadConfig.isOpen, handleNumpadClose]);

    const handleCloseDiscountModal = useCallback(() => {
        setEditingMeasurementForDiscount(null);
    }, []);

    const handleSaveDiscount = useCallback((discount: number, discountType: 'percentage' | 'fixed') => {
        if (!editingMeasurementForDiscount) return;
        
        const updatedMeasurements = activeMeasurements.map(m => 
            m.id === editingMeasurementForDiscount.id ? { ...m, discount, discountType } : m
        );
        handleMeasurementsChange(updatedMeasurements);
        handleCloseDiscountModal();
    }, [editingMeasurementForDiscount, activeMeasurements, handleMeasurementsChange, handleCloseDiscountModal]);

    const carouselRef = useRef<HTMLDivElement>(null);
    const touchStartX = useRef(0);
    const touchCurrentX = useRef(0);
    const isSwiping = useRef(false);

    const handleTouchStart = (e: React.TouchEvent) => {
        if (numpadConfig.isOpen) return;
        touchStartX.current = e.touches[0].clientX;
        isSwiping.current = true;
        if(carouselRef.current) carouselRef.current.style.transition = 'none';
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isSwiping.current || !carouselRef.current) return;
        touchCurrentX.current = e.touches[0].clientX;
    };

    const handleTouchEnd = () => {
        if (!isSwiping.current || !carouselRef.current) return;
        if(carouselRef.current) carouselRef.current.style.transition = 'transform 0.4s ease-in-out';
        isSwiping.current = false;
        const diff = touchCurrentX.current - touchStartX.current;
        const threshold = 50; 

        if (diff > threshold && activeBudgetIndex > 0) {
            setActiveBudgetIndex(activeBudgetIndex - 1);
        } else if (diff < -threshold && activeBudgetIndex < budgets.length - 1) {
            setActiveBudgetIndex(activeBudgetIndex + 1);
        }
    };
    
    const handleDeleteBudget = (indexToDelete: number) => {
        if (budgets.length <= 1) {
            alert("Não é possível excluir a única opção de orçamento.");
            return;
        }
        setBudgetToDeleteIndex(indexToDelete);
    };
    
    const handleConfirmDeleteBudget = () => {
        if (budgetToDeleteIndex === null) return;
        const newBudgets = budgets.filter((_, index) => index !== budgetToDeleteIndex);
        if (activeBudgetIndex >= budgetToDeleteIndex) {
            setActiveBudgetIndex(Math.max(0, activeBudgetIndex - 1));
        }
        setBudgets(newBudgets);
        setBudgetToDeleteIndex(null);
        setIsDirty(true);
    };

    const LoadingSpinner = () => (
        <div className="flex items-center justify-center h-full min-h-[300px]">
            <div className="loader"></div>
        </div>
    );

    const renderContent = () => {
        if (isLoading) {
            return <LoadingSpinner />;
        }

        if (activeTab === 'settings') {
            if (userInfo) {
                return (
                    <Suspense fallback={<LoadingSpinner />}>
                        <UserSettingsView
                            userInfo={userInfo}
                            onSave={handleSaveUserInfo}
                            onOpenPaymentMethods={() => setIsPaymentModalOpen(true)}
                        />
                    </Suspense>
                );
            }
            return null;
        }

        if (activeTab === 'history') {
            return (
                <Suspense fallback={<LoadingSpinner />}>
                    <PdfHistoryView
                        pdfs={allSavedPdfs}
                        clients={clients}
                        agendamentos={agendamentos}
                        onDelete={handleRequestDeletePdf}
                        onDownload={downloadBlob}
                        onUpdateStatus={handleUpdatePdfStatus}
                        onSchedule={handleOpenAgendamentoModal}
                    />
                </Suspense>
            );
        }
        
        if (activeTab === 'agenda') {
            return (
                <Suspense fallback={<LoadingSpinner />}>
                    <AgendaView
                        agendamentos={agendamentos}
                        pdfs={allSavedPdfs}
                        clients={clients}
                        onEditAgendamento={(agendamento) => {
                            const pdf = allSavedPdfs.find(p => p.id === agendamento.pdfId);
                            setSchedulingInfo({ agendamento, pdf });
                        }}
                        onCreateNewAgendamento={handleCreateNewAgendamento}
                    />
                </Suspense>
            );
        }


        if (activeTab === 'films') {
            return (
                <Suspense fallback={<LoadingSpinner />}>
                    <FilmListView
                        films={films}
                        onAdd={() => handleOpenFilmModal(null)}
                        onEdit={handleOpenFilmModal}
                        onDelete={handleRequestDeleteFilm}
                    />
                </Suspense>
            );
        }

        if (clients.length === 0) {
            return (
                <div className="text-center p-8 flex flex-col items-center justify-center h-full min-h-[300px] bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
                    <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mb-4">
                        <i className="fas fa-users fa-2x text-slate-500"></i>
                    </div>
                    <h3 className="text-xl font-semibold text-slate-800">Crie seu Primeiro Cliente</h3>
                    <p className="mt-2 text-slate-600 max-w-xs mx-auto">Tudo começa com um cliente. Adicione os dados para começar a gerar orçamentos.</p>
                    <button
                        onClick={() => handleOpenClientModal('add')}
                        className="mt-6 px-6 py-3 bg-slate-800 text-white font-semibold rounded-lg hover:bg-slate-700 transition duration-300 shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 flex items-center gap-2"
                    >
                        <i className="fas fa-plus"></i>
                        Adicionar Cliente
                    </button>
                </div>
            );
        }
        if (selectedClientId && activeMeasurements.length > 0) {
             return (
                <MeasurementList
                    measurements={activeMeasurements}
                    films={films}
                    onMeasurementsChange={handleMeasurementsChange}
                    onOpenFilmModal={handleOpenFilmModal}
                    onOpenFilmSelectionModal={handleOpenFilmSelectionModal}
                    onOpenClearAllModal={() => setIsClearAllModalOpen(true)}
                    onOpenApplyFilmToAllModal={() => setIsApplyFilmToAllModalOpen(true)}
                    numpadConfig={numpadConfig}
                    onOpenNumpad={handleOpenNumpad}
                    activeMeasurementId={numpadConfig.measurementId}
                    onOpenEditModal={handleOpenEditMeasurementModal}
                    onOpenDiscountModal={handleOpenDiscountModal}
                />
            );
        }
        if (selectedClientId && activeMeasurements.length === 0) {
             return (
                <div className="text-center p-8 flex flex-col items-center justify-center h-full min-h-[300px] bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
                    <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mb-4">
                        <i className="fas fa-ruler-combined fa-2x text-slate-500"></i>
                    </div>
                    <h3 className="text-xl font-semibold text-slate-800">Adicione a Primeira Medida</h3>
                    <p className="mt-2 text-slate-600 max-w-xs mx-auto">Insira as dimensões (largura, altura, etc.) para calcular o orçamento deste cliente.</p>
                    <button
                        onClick={addMeasurement}
                        className="mt-6 px-6 py-3 bg-slate-800 text-white font-semibold rounded-lg hover:bg-slate-700 transition duration-300 shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 flex items-center gap-2"
                    >
                        <i className="fas fa-plus"></i>
                        Adicionar Medida
                    </button>
                </div>
            );
        }
         return (
            <div className="text-center text-slate-500 p-8 flex flex-col items-center justify-center h-full min-h-[300px]">
                <i className="fas fa-user-check fa-3x mb-4 text-slate-300"></i>
                <h3 className="text-xl font-semibold">Selecione um Cliente</h3>
                <p>Use o menu acima para escolher um cliente e ver suas medidas.</p>
            </div>
        );
    }

    return (
        <div className="h-full font-roboto flex flex-col">
            <AppHeader toggleFullScreen={toggleFullScreen} />

            <main ref={mainRef} className="flex-grow overflow-y-auto pb-36 sm:pb-0">
                <div className="sticky top-0 bg-white/80 backdrop-blur-sm z-10 border-b border-slate-200">
                    <div className="container mx-auto px-2 sm:px-4 w-full max-w-2xl">
                        <div className="py-2 sm:py-3">
                            <Header
                                activeTab={activeTab}
                                onTabChange={handleTabChange}
                            />
                        </div>
                    </div>
                </div>

                <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8 w-full max-w-2xl">
                    <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6">
                       {activeTab === 'client' ? (
                           <>
                               {clients.length > 0 ? (
                                   <div className="bg-slate-100 p-4 rounded-xl">
                                       <ClientBar
                                           selectedClient={selectedClient}
                                           onSelectClientClick={handleOpenClientSelectionModal}
                                           onAddClient={() => handleOpenClientModal('add')}
                                           onEditClient={() => handleOpenClientModal('edit')}
                                           onDeleteClient={handleDeleteClient}
                                       />
                                       {selectedClientId && (
                                           <>
                                                <BudgetTabs
                                                    budgets={budgets}
                                                    activeBudgetIndex={activeBudgetIndex}
                                                    onSelect={setActiveBudgetIndex}
                                                    onAdd={handleCreateNewBudgetOption}
                                                    onDelete={handleDeleteBudget}
                                                />
                                                <div id="contentContainer" className="w-full min-h-[300px] overflow-hidden" 
                                                    onTouchStart={handleTouchStart}
                                                    onTouchMove={handleTouchMove}
                                                    onTouchEnd={handleTouchEnd}
                                                >
                                                     <div 
                                                        ref={carouselRef}
                                                        className="flex transition-transform duration-300 ease-in-out"
                                                        style={{ width: `${budgets.length * 100}%`, transform: `translateX(-${(activeBudgetIndex / budgets.length) * 100}%)` }}
                                                    >
                                                         {budgets.map((budget, index) => (
                                                            <div key={budget.id} className="w-full flex-shrink-0" style={{ width: `${100 / budgets.length}%` }}>
                                                                {renderContent()}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                           </>
                                       )}
                                   </div>
                               ) : (
                                   <div id="contentContainer" className="w-full min-h-[300px]">
                                       {renderContent()}
                                   </div>
                               )}
                           </>
                       ) : ['history', 'agenda'].includes(activeTab) ? (
                           <div className="bg-blue-50 -m-4 sm:-m-6 p-4 sm:p-6 rounded-2xl">
                               <div id="contentContainer" className="w-full min-h-[300px]">
                                   {renderContent()}
                               </div>
                           </div>
                       ) : (
                           <div id="contentContainer" className="w-full min-h-[300px]">
                               {renderContent()}
                           </div>
                       )}


                        {activeTab === 'client' && selectedClientId && activeBudget && (
                            <>
                                <div className="hidden sm:block mt-6 pt-6 border-t border-slate-200">
                                   <SummaryBar 
                                        totals={totals}
                                        generalDiscount={activeBudget.generalDiscount}
                                        onGeneralDiscountChange={handleGeneralDiscountChange}
                                        isDesktop
                                    />
                                   <ActionsBar
                                        onAddMeasurement={addMeasurement}
                                        onAddNewOption={handleCreateNewBudgetOption}
                                        onGeneratePdf={handleGeneratePdf}
                                        onOpenAIModal={() => setIsAIModalOpen(true)}
                                        isGeneratingPdf={pdfGenerationStatus === 'generating'}
                                   />
                                </div>
                                <MobileFooter
                                    totals={totals}
                                    generalDiscount={activeBudget.generalDiscount}
                                    onGeneralDiscountChange={handleGeneralDiscountChange}
                                    onAddMeasurement={addMeasurement}
                                    onAddNewOption={handleCreateNewBudgetOption}
                                    onGeneratePdf={handleGeneratePdf}
                                    onOpenAIModal={() => setIsAIModalOpen(true)}
                                    isGeneratingPdf={pdfGenerationStatus === 'generating'}
                                />
                            </>
                        )}
                    </div>
                </div>
            </main>

            
            {isClientModalOpen && (
                <ClientModal
                    isOpen={isClientModalOpen}
                    onClose={() => {
                        setIsClientModalOpen(false);
                        setNewClientName('');
                    }}
                    onSave={handleSaveClient}
                    mode={clientModalMode}
                    client={clientModalMode === 'edit' ? selectedClient : null}
                    initialName={newClientName}
                    onProcessImage={handleProcessAIClientInfo}
                />
            )}
            {isClientSelectionModalOpen && (
                <ClientSelectionModal
                    isOpen={isClientSelectionModalOpen}
                    onClose={() => setIsClientSelectionModalOpen(false)}
                    clients={clients}
                    onClientSelect={setSelectedClientId}
                    isLoading={isLoading}
                    onAddNewClient={handleAddNewClientFromSelection}
                />
            )}
            {isPaymentModalOpen && userInfo && (
                <PaymentMethodsModal
                    isOpen={isPaymentModalOpen}
                    onClose={() => setIsPaymentModalOpen(false)}
                    onSave={handleSavePaymentMethods}
                    paymentMethods={userInfo.payment_methods}
                />
            )}
            {isFilmModalOpen && (
                 <FilmModal
                    isOpen={isFilmModalOpen}
                    onClose={() => {
                        setIsFilmModalOpen(false);
                        setEditingFilm(null);
                    }}
                    onSave={handleSaveFilm}
                    onDelete={handleDeleteFilm}
                    film={editingFilm}
                 />
            )}
            {isFilmSelectionModalOpen && (
                <FilmSelectionModal
                    isOpen={isFilmSelectionModalOpen}
                    onClose={() => {
                        setIsFilmSelectionModalOpen(false);
                        setEditingMeasurementIdForFilm(null);
                    }}
                    films={films}
                    onSelect={handleSelectFilmForMeasurement}
                    onAddNewFilm={handleAddNewFilmFromSelection}
                    onEditFilm={handleEditFilmFromSelection}
                    onDeleteFilm={handleRequestDeleteFilm}
                />
            )}
             {isApplyFilmToAllModalOpen && (
                <FilmSelectionModal
                    isOpen={isApplyFilmToAllModalOpen}
                    onClose={() => setIsApplyFilmToAllModalOpen(false)}
                    films={films}
                    onSelect={handleApplyFilmToAll}
                    onAddNewFilm={handleAddNewFilmFromSelection}
                    onEditFilm={handleEditFilmFromSelection}
                    onDeleteFilm={handleRequestDeleteFilm}
                />
            )}
            {isAIModalOpen && (
                <AIMeasurementModal
                    isOpen={isAIModalOpen}
                    onClose={() => setIsAIModalOpen(false)}
                    onProcess={handleProcessAIMeasurements}
                    isProcessing={isProcessingAI}
                />
            )}
             {schedulingInfo && (
                <AgendamentoModal
                    isOpen={!!schedulingInfo}
                    onClose={handleCloseAgendamentoModal}
                    onSave={handleSaveAgendamento}
                    onDelete={handleRequestDeleteAgendamento}
                    schedulingInfo={schedulingInfo}
                    clients={clients}
                    onAddNewClient={handleAddNewClientFromAgendamento}
                    userInfo={userInfo}
                    agendamentos={agendamentos}
                />
            )}
            {editingMeasurement && (
                <EditMeasurementModal
                    isOpen={!!editingMeasurement}
                    onClose={handleCloseEditMeasurementModal}
                    measurement={editingMeasurement}
                    films={films}
                    onUpdate={handleUpdateEditingMeasurement}
                    onDelete={() => {
                        handleMeasurementsChange(activeMeasurements.filter(m => m.id !== editingMeasurement.id));
                        handleCloseEditMeasurementModal();
                    }}
                    onDuplicate={() => {
                        const measurementToDuplicate = activeMeasurements.find(m => m.id === editingMeasurement.id);
                        if (measurementToDuplicate) {
                            const newMeasurement: UIMeasurement = { 
                                ...measurementToDuplicate, 
                                id: Date.now(), 
                                isNew: false // Don't focus in this context
                            };
                            const index = activeMeasurements.findIndex(m => m.id === measurementToDuplicate.id);
                            const newMeasurements = [...activeMeasurements];
                            newMeasurements.splice(index + 1, 0, newMeasurement);
                            handleMeasurementsChange(newMeasurements);
                        }
                        handleCloseEditMeasurementModal();
                    }}
                    onOpenFilmModal={handleOpenFilmModal}
                    onOpenFilmSelectionModal={handleOpenFilmSelectionModal}
                    numpadConfig={numpadConfig}
                    onOpenNumpad={handleOpenNumpad}
                />
            )}
            {isClearAllModalOpen && (
                <ConfirmationModal
                    isOpen={isClearAllModalOpen}
                    onClose={() => setIsClearAllModalOpen(false)}
                    onConfirm={handleConfirmClearAll}
                    title="Confirmar Exclusão Total"
                    message="Tem certeza que deseja apagar TODAS as medidas para esta opção de orçamento? Esta ação não pode ser desfeita."
                    confirmButtonText="Sim, Excluir Tudo"
                    confirmButtonVariant="danger"
                />
            )}
             {filmToDeleteName !== null && (
                <ConfirmationModal
                    isOpen={filmToDeleteName !== null}
                    onClose={() => setFilmToDeleteName(null)}
                    onConfirm={handleConfirmDeleteFilm}
                    title="Confirmar Exclusão de Película"
                    message={<>Tem certeza que deseja apagar a película <strong>{filmToDeleteName}</strong>? Esta ação não pode ser desfeita.</>}
                    confirmButtonText="Sim, Excluir"
                    confirmButtonVariant="danger"
                />
            )}
            {filmToApplyToAll !== null && (
                <ConfirmationModal
                    isOpen={filmToApplyToAll !== null}
                    onClose={() => setFilmToApplyToAll(null)}
                    onConfirm={handleConfirmApplyFilmToAll}
                    title="Aplicar Película a Todos"
                    message={<>Tem certeza que deseja aplicar a película <strong>{filmToApplyToAll}</strong> a todas as {activeMeasurements.length} medidas? Isso substituirá as películas já selecionadas.</>}
                    confirmButtonText="Sim, Aplicar a Todas"
                />
            )}
            {isDeleteClientModalOpen && selectedClient && (
                <ConfirmationModal
                    isOpen={isDeleteClientModalOpen}
                    onClose={() => setIsDeleteClientModalOpen(false)}
                    onConfirm={handleConfirmDeleteClient}
                    title="Confirmar Exclusão de Cliente"
                    message={
                        <>
                            <p className="text-slate-700">Tem certeza que deseja apagar o cliente <strong>{selectedClient.nome}</strong>?</p>
                            <div className="mt-4 bg-red-50 p-3 rounded-lg border border-red-200 text-sm text-red-800">
                                <div className="flex">
                                    <div className="flex-shrink-0">
                                        <i className="fas fa-exclamation-triangle text-red-500 h-5 w-5" aria-hidden="true"></i>
                                    </div>
                                    <div className="ml-3">
                                        <p>
                                            Todas as suas medidas e histórico de orçamentos (PDFs) serão <strong>perdidos permanentemente</strong>. Esta ação não pode ser desfeita.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </>
                    }
                    confirmButtonText="Sim, Excluir Cliente"
                    confirmButtonVariant="danger"
                />
            )}
            {pdfToDeleteId !== null && (
                <ConfirmationModal
                    isOpen={pdfToDeleteId !== null}
                    onClose={() => setPdfToDeleteId(null)}
                    onConfirm={handleConfirmDeletePdf}
                    title="Confirmar Exclusão de Orçamento"
                    message="Tem certeza que deseja apagar este orçamento do histórico? Esta ação não pode ser desfeita."
                    confirmButtonText="Sim, Excluir"
                    confirmButtonVariant="danger"
                />
            )}
            {agendamentoToDelete && (
                <ConfirmationModal
                    isOpen={!!agendamentoToDelete}
                    onClose={() => setAgendamentoToDelete(null)}
                    onConfirm={handleConfirmDeleteAgendamento}
                    title="Confirmar Exclusão"
                    message={
                        <>
                            Tem certeza que deseja apagar o agendamento para <strong>{agendamentoToDelete.clienteNome}</strong> em <strong>{new Date(agendamentoToDelete.start).toLocaleDateString('pt-BR')}</strong>?
                        </>
                    }
                    confirmButtonText="Sim, Excluir Agendamento"
                    confirmButtonVariant="danger"
                />
            )}
            {budgetToDeleteIndex !== null && (
                <ConfirmationModal
                    isOpen={budgetToDeleteIndex !== null}
                    onClose={() => setBudgetToDeleteIndex(null)}
                    onConfirm={handleConfirmDeleteBudget}
                    title="Confirmar Exclusão"
                    message={<>Tem certeza que deseja apagar a <strong>{budgets[budgetToDeleteIndex]?.name}</strong>? Esta ação não pode ser desfeita.</>}
                    confirmButtonText="Sim, Excluir Opção"
                    confirmButtonVariant="danger"
                />
            )}
             {pdfGenerationStatus !== 'idle' && (
                <PdfGenerationStatusModal
                    status={pdfGenerationStatus as 'generating' | 'success'}
                    onClose={handleClosePdfStatusModal}
                    onGoToHistory={handleGoToHistoryFromPdf}
                />
            )}
             {editingMeasurementForDiscount && (
                <DiscountModal
                    isOpen={!!editingMeasurementForDiscount}
                    onClose={handleCloseDiscountModal}
                    onSave={handleSaveDiscount}
                    initialValue={editingMeasurementForDiscount.discount}
                    initialType={editingMeasurementForDiscount.discountType}
                />
            )}
            {numpadConfig.isOpen && (
                <CustomNumpad
                    ref={numpadRef}
                    onInput={handleNumpadInput}
                    onDelete={handleNumpadDelete}
                    onDone={handleNumpadDone}
                    onClose={handleNumpadClose}
                    onDuplicate={handleNumpadDuplicate}
                    onClear={handleNumpadClear}
                    onAddGroup={handleNumpadAddGroup}
                    activeField={numpadConfig.field}
                />
            )}
        </div>
    );
};

export default App;