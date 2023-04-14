import React, { useContext, useState } from "react";
import { useEffect } from "react";

declare global {
    interface Window {
        LibSANE: any
    }
}

const initialValue = {
    LibSANE: null as any,
    state: null,
};

const SANEContext = React.createContext(initialValue);

export const useSANEContext = () => useContext(SANEContext);

export const SANEContextProvider = ({ children }: { children: any }) => {
    const [value, setValue] = useState(initialValue);
    useEffect(() => {
        window.LibSANE().then((LibSANE: any) => {
            LibSANE.sane_init();
            const state = LibSANE.sane_get_state();
            setValue({ ...value, LibSANE, state });
        });
        window.LibSANE = "poof!"; // nuke global variable
        // eslint-disable-next-line
    }, []);
    return (
        <SANEContext.Provider value={value}>
            {children}
        </SANEContext.Provider>
    );
}
