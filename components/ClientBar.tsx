import React, { useState, useRef, useEffect } from 'react';
import { Client } from '../types';
import Tooltip from './ui/Tooltip';

interface ClientBarProps {
    selectedClient: Client | null;
    onSelectClientClick: () => void;
    onAddClient: () => void;
    onEditClient: () => void;
    onDeleteClient: () => void;
}

const formatAddress = (client: Client): string => {
    const parts = [
        client.logradouro,
        client.numero,
        client.bairro,
        client.cidade,
        client.uf,
    ];
    return parts.filter(Boolean).join(', ');
}

const ClientBar: React.FC<ClientBarProps> = ({
    selectedClient,
    onSelectClientClick,
    onAddClient,
    onEditClient,
    onDeleteClient,
}) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const MenuItem: React.FC<{
        onClick: () => void;
        icon: string;
        label: string;
        isDestructive?: boolean;
        disabled?: boolean;
    }> = ({ onClick, icon, label, isDestructive = false, disabled = false }) => (
        <li>
            <button
                onClick={() => { if (!disabled) { onClick(); setIsMenuOpen(false); } }}
                disabled={disabled}
                className={`flex items-center w-full px-3 py-2 text-sm rounded-md ${
                    disabled
                        ? 'text-slate-400 cursor-not-allowed'
                        : isDestructive
                        ? 'text-red-600 hover:bg-red-50 hover:text-red-700'
                        : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                }`}
            >
                <i className={`${icon} mr-3 h-5 w-5 ${disabled ? 'text-slate-300' : isDestructive ? 'text-red-400' : 'text-slate-400'}`}></i>
                {label}
            </button>
        </li>
    );

    const fullAddress = selectedClient ? formatAddress(selectedClient) : '';

    return (
        <div className="flex items-center justify-between mb-4">
            <div 
                onClick={onSelectClientClick}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelectClientClick() }}
                className="text-left flex-grow pr-4 py-2 rounded-lg hover:bg-slate-50 transition-colors min-w-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-300"
                aria-label="Trocar de cliente"
            >
                {selectedClient ? (
                    <>
                        <div className="flex items-baseline gap-2">
                            <span className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Cliente:</span>
                            {selectedClient.telefone && (
                                <span className="font-medium text-sm text-slate-600">
                                    {selectedClient.telefone}
                                </span>
                            )}
                        </div>
                        <h2 className="text-xl font-bold text-slate-800 leading-tight truncate mt-0.5">
                            {selectedClient.nome}
                        </h2>
                        {fullAddress && (
                             <a
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="mt-1 group flex items-center gap-2 text-sm text-slate-600 hover:text-blue-600 transition-colors"
                                aria-label={`Abrir endereço no mapa: ${fullAddress}`}
                            >
                                <i className="fas fa-map-marker-alt text-slate-400 group-hover:text-blue-500 flex-shrink-0"></i>
                                <span className="truncate group-hover:underline">{fullAddress}</span>
                            </a>
                        )}
                    </>
                ) : (
                    <>
                        <span className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Cliente</span>
                        <h2 className="text-xl font-bold text-slate-800 leading-tight truncate mt-1">
                            Nenhum cliente selecionado
                        </h2>
                    </>
                )}
            </div>

            <div className="relative flex-shrink-0" ref={menuRef}>
                <Tooltip text="Ações do Cliente">
                    <button
                        onClick={() => setIsMenuOpen(prev => !prev)}
                        className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg transition duration-200 text-slate-600 bg-white hover:bg-slate-200 hover:text-slate-800"
                        aria-label="Ações do Cliente"
                        aria-haspopup="true"
                        aria-expanded={isMenuOpen}
                    >
                        <i className="fas fa-ellipsis-v"></i>
                    </button>
                </Tooltip>

                {isMenuOpen && (
                    <div className="absolute right-0 mt-2 w-56 origin-top-right bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-20 p-1">
                        <ul className="space-y-1">
                            <MenuItem
                                onClick={onAddClient}
                                icon="fas fa-plus"
                                label="Adicionar Cliente"
                            />
                            <MenuItem
                                onClick={onEditClient}
                                icon="fas fa-pen"
                                label="Editar Cliente"
                                disabled={!selectedClient}
                            />
                            <MenuItem
                                onClick={onDeleteClient}
                                icon="fas fa-trash-alt"
                                label="Excluir Cliente"
                                isDestructive
                                disabled={!selectedClient}
                            />
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
};

export default React.memo(ClientBar);