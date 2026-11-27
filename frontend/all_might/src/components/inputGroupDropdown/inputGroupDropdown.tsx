import styles from './inputGroupDropdown.module.css'
import { InputGroup, Button, Dropdown, Form } from "react-bootstrap";
import { useState } from 'react';

interface DropdownData {
    id: string | number;
    name: string;
};

interface InputGroupDropdownProps {
    data: DropdownData[];
    onClickOne: (data: DropdownData | null) => void;
    title: string;
    value: string | null | undefined;
    minWidth?: number;
}

/* A labelled field that opens a searchable list. "TODOS" at the top clears the
   choice (onClickOne(null)). */
export default function InputGroupDropdown({ data, title, value, onClickOne, minWidth = 150 }: InputGroupDropdownProps) {
    const [show, setShow] = useState<boolean>(false);
    const [searchTerm, setSearchTerm] = useState('');

    const filteredItems = data
        .filter(item => (item.name ?? '').toLowerCase().includes(searchTerm.toLowerCase()))
        .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));

    const pick = (e: React.MouseEvent<HTMLElement>, item: DropdownData | null) => {
        e.stopPropagation();
        onClickOne(item);
        setShow(false);
    };

    return (
        <>
            <InputGroup>
                <InputGroup.Text style={{ minWidth: `${minWidth}px` }}>{title}</InputGroup.Text>
                <Button
                    variant="light"
                    className={`${styles.dropdownContainer} form-control`}
                    style={{
                        /* A chosen value reads as content; the "Selecionar" prompt
                           reads as placeholder. Both come from the token set. */
                        color: value ? 'var(--text)' : 'var(--muted)',
                    }}
                    onClick={() => setShow(true)}
                >
                    {value || 'Selecionar'}
                </Button>
            </InputGroup>
            <Dropdown show={show} onToggle={(nextShow) => { if (!nextShow) setShow(false); }}>
                <Dropdown.Menu rootCloseEvent='click' style={{ marginTop: '5px', minWidth: '250px' }}>
                    <div className="px-3 py-2">
                        <Form.Control
                            type="text"
                            placeholder="Pesquisar"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>

                    <Dropdown.Divider />
                    <div className={styles.dropdownItemsContainer}>
                        <Dropdown.Item key="none" onClick={(e) => pick(e, null)}>
                            TODOS
                        </Dropdown.Item>

                        {filteredItems.length > 0 ? (
                            filteredItems.map(item => (
                                <Dropdown.Item key={item.id} onClick={(e) => pick(e, item)}>
                                    {item.name}
                                </Dropdown.Item>
                            ))
                        ) : (
                            <Dropdown.Item disabled className="text-muted">
                                Nenhum resultado encontrado
                            </Dropdown.Item>
                        )}
                    </div>
                </Dropdown.Menu>
            </Dropdown>
        </>
    )
}
