import fetch, { Response } from "node-fetch";
import { parse } from 'node-html-parser';
import { writeCase } from "./json";

const BASE_URL = 'https://www.cnes-geipan.fr';
const PAGINATION_URL = `${BASE_URL}/fr/recherche/cas/tab?`;
let statusCode = 0;


export interface Case {
    geipan_id?: string;
    title: string;
    shortDescription: string;
    description: string | undefined;
    observationAt : Date | string;
    region: string;
    department: string;
    classification: 'A' | 'B' | 'C' | 'D';
    modifiedAt: Date | string;
    typeEvent: string;
    strange: number;
    consistance: number;
    documents: {name: string, link: string}[];
    testimonials: Testimony[];
}

interface Testimony {
    geipan_id?: string;
    cas_title: string;
    observationAt: Date | string;
    age: number;
    gender: 'H' | 'M';
    environment: string;
    localTime: Date | string;
    environment2: string;
    distanceEventWitness: string;
    location: Location;
}

interface Location {
    observationType: string;
    specificityObservation: string;
    shape: string;
    color: string;
    size: string;
    numberEvent: string;
}
let casesFinal: Case[] = [];
(async function() {
    let i = 0;
    let nbFichier = 0;
    let isEmpty = false;
    do {
        try {
            const res = await fetchCasList(i);
            statusCode = res.status;
            console.log(`${res.url} ${res.status}`);
            const pageContent = await res.text();
            isEmpty = pageContent.includes('Aucun résultat');
    
            if (!isEmpty) {
                const caseLinks = extactLinks(pageContent);
            
                const promiseCasDetails = caseLinks.map(link => fetchFromLink(link));
                const casResults = await Promise.all(promiseCasDetails);
                
                const casesPromises = casResults.map((caseContent, index) => extractCaseData(caseContent, caseLinks[index]));
                const cases = await Promise.all(casesPromises);
                casesFinal = [...casesFinal, ...cases];
    
                if (casesFinal.length > 200) {
                    ++nbFichier;
                    casesFinal = [];
                }
                console.log(`${res.url} [DONE]`);
            }
            
            void await writeCase(nbFichier, casesFinal);
            
            ++i;
        }
        catch(err) {
            console.log(err);
        }
        
    } while(statusCode === 200 && !isEmpty);
})()

function extactLinks(pageContent: string): string[] {
    const html = parse(pageContent);
    return html.querySelectorAll('.custom-link-to > a')
    .map(link => link.getAttribute('href'))
    .filter(link => !link?.includes('recherche'))
    .map(link => `${BASE_URL}${link}`);
}



async function extractCaseData(caseContent: string, url: string): Promise<Case> {
    const html = parse(caseContent);
    const title = html.querySelector('.cas__title > h2')?.textContent.trim();
    const shortDescription = html.querySelector('.cas__chapo .field-value')?.textContent.trim();
    const description = html.querySelector('.cas__body .field-value')?.textContent.trim();
    const sidebarBlock = html.querySelectorAll('.sidebar-bloc .one_info-data').map(block => block?.textContent.trim());
    const urlSplit = url.split('/');
    const documents = html.querySelectorAll('.documents a')
    .map(doc => ({name: doc.textContent.trim(), link: doc.getAttribute('href')}));
    const testimonialsHtml = html.querySelectorAll('.temoignages a')
    .map(tem => ({name: tem.textContent.trim(), link: tem.getAttribute('href')}));

    const testimonials = testimonialsHtml.filter(tem => tem.link?.includes('temoignage'));
    const testimonialsFiles = testimonialsHtml.filter(tem => !tem.link?.includes('temoignage'));

        
    const testimonialsResults = await Promise.all(testimonials
        .filter(tem => tem.link !== undefined)
        .map(tem => fetchFromLink(`${BASE_URL}${tem.link}` as string)))

    return {
        geipan_id: urlSplit[urlSplit.length - 1],
        title,
        shortDescription,
        description,
        observationAt: sidebarBlock[0],
        region: sidebarBlock[1],
        department: sidebarBlock[2],
        classification: sidebarBlock[3],
        modifiedAt: sidebarBlock[4],
        typeEvent: sidebarBlock[5],
        documents: [...documents, ...testimonialsFiles],
        strange: !isNaN(parseFloat(sidebarBlock[6])) ? parseFloat(sidebarBlock[6]): 0,
        consistance: !isNaN(parseFloat(sidebarBlock[7])) ? parseFloat(sidebarBlock[7]): 0,
        testimonials: testimonialsResults.map((tem, index) => extractTemData(tem, testimonialsHtml[index].link as string))
    } as Case;

}

function extractTemData(temContent: string, url: string): Testimony {
    const html = parse(temContent);
    
    const title = html.querySelector('.cas__title > h2').textContent.trim();
    const observationAt = html.querySelector('.field--name-field-date-d-observation-tem .field__item')?.textContent.trim();
    const age = html.querySelector('.field--name-field-age-wysiwyg .field__item')?.textContent.trim();
    const gender = html.querySelector('.field--name-field-genre-wysiwyg .field__item')?.textContent.trim();
    const environment = html.querySelector('.field--name-field-env-sol-wysiwyg .field__item')?.textContent.trim();
    const localTime = html.querySelector('.field--name-field-date-heure-locale-wysiwyg .field__item')?.textContent.trim();
    const environment2 = html.querySelector('.field--name-field-cadre-ref-wysiwyg .field__item')?.textContent.trim();
    const distanceEventWitness = html.querySelector('.field field--name-field-distance-temoin-wysiwyg .field__item')?.textContent.trim();
    const observationType = html.querySelector('.field--name-field-nature-wysiwyg .field__item')?.textContent.trim();
    const specificityObservation = html.querySelector('.field--name-field-caracteristique-wysiwyg .field__item')?.textContent.trim();
    const shape = html.querySelector('.field--name-field-forme-wysiwyg .field__item')?.textContent.trim();
    const color = html.querySelector('.field--name-field-couleur-wysiwyg .field__item')?.textContent.trim();
    const size = html.querySelector('.field--name-field-taille-wysiwyg .field__item')?.textContent.trim();
    const numberEvent = html.querySelector('.field--name-field-nombre-phenomene-wysiwyg .field__item')?.textContent.trim();
    
    const urlSplit = url.split('/');

    return {
        geipan_id: urlSplit[urlSplit.length - 1],
        cas_title: title,
        observationAt,
        age: parseInt(age, 10),
        gender,
        environment,
        localTime,
        environment2,
        distanceEventWitness,
        location: {
            color,
            numberEvent,
            observationType,
            size,
            shape,
            specificityObservation
        }
    } as Testimony;
}


function fetchFromLink(casLink: string): Promise<string> {
    return fetch(casLink)
    .then(res => res.text());
}


function fetchCasList(page: number): Promise<Response> {
    return fetch(`${PAGINATION_URL}page=${page}`, {
        method: 'GET',
        headers: {
            'content-type': 'text/html'
        }
    });
}


