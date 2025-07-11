import * as _ from 'lodash-es';
import { Card } from './game';

export class ingredient {
    key = "";
    have = 0;
}

export class Receipe {
    letter = "";
    weight = 0;
    ingredients: ingredient[] = [];
    completed = false;

    constructor(letter: string, weight: number){
        this.letter = letter;
        this.weight = weight;
    }
    generateReceipes( productionCards:number){
        for (let i = 1; i <= productionCards; i++) {
            this.ingredients.push({key: `${this.letter}${this.weight}${i}`, have: 0});
        }   
    }
}

export function getAvailableReceipes(items:Card[], productionCards:number){
    const receipes:Set<Receipe> = new Set();
    _.forEach(items, item => {
        const receipe = new Receipe(item.letter, item.weight);
        receipes.add(receipe);
    });  
    receipes.forEach(receipe => {
        receipe.generateReceipes(productionCards);
    });

    //receipe check have ingredient
    receipes.forEach(receipe => {
        receipe.ingredients.forEach(ingredient => {
            ingredient.have = _.filter(items, item => item.key == ingredient.key).length;
        });
    });

    //receipe check completed
    receipes.forEach(receipe => {
        receipe.completed = receipe.ingredients.every(ingredient => ingredient.have > 0);
    });

    return Array.from(receipes);
}
